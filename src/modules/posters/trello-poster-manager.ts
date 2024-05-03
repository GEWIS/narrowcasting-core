import { randomUUID } from 'crypto';
import {Board, Card, Checklist, DefaultService, TrelloList} from '@gewis/trello-client';
import { PosterManager } from './poster-manager';
import {
    BasePoster,
    ErrorPoster,
    FooterSize,
    LocalPoster,
    LocalPosterType,
    MediaPoster,
    Poster,
    PosterType,
} from './poster';
import { TrelloPosterStorage } from './trello-poster-storage';

const DEFAULT_POSTER_TIMEOUT = 15;
const DEFAULT_POSTER_REFRESH = 1000 * 60 * 15;

export class TrelloPosterManager extends PosterManager {
    private refreshTimeout: NodeJS.Timeout | undefined = undefined;

    /**
     * Parse a Trello list recursively to a list of posters
     * @param list
     * @param board
     * @param listType
     * @private
     */
    private async parseLists(
        list: TrelloList,
        board: Board,
        listType?: PosterType,
    ): Promise<Poster[]> {
        const { cards: allCards, lists: allLists, checklists: allChecklists } = board;
        const cards = allCards?.filter((card) => card.idList === list.id) || [];

        const now = new Date();

        const posters = await Promise.all(
            cards.map(async (card) => {
                const labels = card.labels?.map((l) => l.name ?? '') ?? [];
                const checklists =
                    allChecklists?.filter((checklist) => card.idChecklists?.includes(checklist.id!)) ?? [];

                // A card can be two things: a poster, or a reference to a new list of cards.
                // If it has the correct label ("Posterlist"), it means the card is a reference to a list
                if (labels.includes('Posterlist')) {
                    const newList = allLists?.find((l) => l.name === card.name);
                    if (newList) {
                        return this.parseLists(newList, board, card.desc as PosterType);
                    }
                    throw new Error(`Unknown list: ${card.name}`);
                }

                const borrelMode = labels.includes('BorrelMode');

                // If the card has a due date and this due date is in the past, skip this card
                if (card.due && new Date(card.due) < now) return undefined;
                // If the card has a start date and this start date is in the future, skip this card
                if (card.badges?.start != null && new Date(card.badges.start) > now) return undefined;

                switch (listType) {
                    case 'img':
                    case 'video':
                        return this.parseMediaPoster(card, checklists);
                    case 'extern':
                        return this.parseExternalPoster(card, checklists);
                    case 'photo':
                        return this.parsePhotoPoster(card, checklists);
                    default:
                        break;
                }

                let type: LocalPosterType = (listType as LocalPosterType) || PosterType.UNKNOWN;
                const cardType = card.desc;
                if (listType === undefined && Object.values(PosterType).includes(cardType as any)) {
                    type = cardType as LocalPosterType;
                }

                const poster: LocalPoster = {
                    ...this.parseBasePoster(card, checklists, borrelMode),
                    type,
                };

                return poster;
            }),
        );

        return posters.filter((p) => p !== undefined).flat() as Poster[];
    }

    /**
     * Parse all generic poster information
     * @param card
     * @param checklists
     * @param borrelMode
     * @private
     */
    private parseBasePoster(card: Card, checklists: Checklist[], borrelMode: boolean): BasePoster {
        // Find the index of the "timeout" checklist if it exists
        // @ts-ignore
        const indexTimeout = checklists.findIndex(
            (checklist) => checklist.name.toLowerCase() === 'timeout',
        );
        // If it does exist, take the value of the first checkbox and make it the timeout value
        let timeout: number = DEFAULT_POSTER_TIMEOUT;
        if (indexTimeout !== undefined && indexTimeout > -1) {
            // @ts-ignore
            timeout = parseInt(checklists![indexTimeout].checkItems[0]?.name, 10);
        }

        const labels = card.labels?.map((l) => l.name ?? '') ?? [];
        const hideBorder = labels.includes('HIDE_BORDER');
        const footers = labels.filter((l) => !['HIDE_BORDER', 'BorrelMode'].includes(l));

        return {
            id: card.id ?? randomUUID(),
            name: card.name || 'Poster',
            timeout,
            // If there is a due date present, set the due date
            due: card.due ? new Date(card.due) : undefined,
            // If there are labels, set the label of this poster to be the first label of the card
            label: footers.length > 0 ? labels[0] : '',
            // If the card has a HIDE_LABEL label, set the footer size to minimal
            footer: hideBorder ? FooterSize.MINIMAL : FooterSize.FULL,
            borrelMode,
        };
    }

    /**
     * Given an image or video card, parse it and store its attachments for fetching later
     * @param card
     * @param checklists
     * @param borrelMode
     * @private
     */
    private async parseMediaPoster(
        card: Card,
        checklists: Checklist[],
        borrelMode = false,
    ): Promise<MediaPoster | ErrorPoster> {
        const poster = this.parseBasePoster(card, checklists, borrelMode);

        if (!card.id) {
            return {
                ...poster,
                type: PosterType.ERROR,
                message: 'Card has no ID',
            };
        }
        const attachments = await DefaultService.getCardsIdAttachments({
            id: card.id
        })
        const source = await Promise.all(
            attachments.map(async (attachment) => {
                const storage = new TrelloPosterStorage();
                return storage.storeAttachment(attachment);
            }),
        );

        return {
            ...poster,
            type: PosterType.IMAGE,
            source,
        };
    }

    /**
     * Given a photo card, parse it and its albums
     * @param card
     * @param checklists
     * @param borrelMode
     * @private
     */
    private async parsePhotoPoster(
        card: Card,
        checklists: Checklist[],
        borrelMode = false,
    ): Promise<Poster> {
        // Find the checklist called "photos", that should contain the album ids
        const index = checklists.findIndex((checklist) => checklist.name.toLowerCase() === 'photos');
        // If such list cannot be found, it does not exist. Throw an error because we cannot continue
        if (index === undefined || index < 0) {
            return {
                ...this.parseBasePoster(card, checklists, borrelMode),
                type: PosterType.ERROR,
                message: 'Photo card has no checklist named "photos"',
            };
        }
        // Get the checklist for the albums
        const checkList = checklists![index];
        // @ts-ignore
        const albums = checkList.checkItems.map((item: any) => item.name.split(' ')[0]);
        return {
            ...this.parseBasePoster(card, checklists, borrelMode),
            type: PosterType.PHOTO,
            albums,
        };
    }

    /**
     * Parse the given poster to an EXTERNAL type poster
     * If the card description is an invalid URL, return an ERROR poster
     * @param card
     * @param checklists
     * @param borrelMode
     * @private
     */
    private async parseExternalPoster(
        card: Card,
        checklists: Checklist[],
        borrelMode = false,
    ): Promise<Poster> {
        const isUrl = (url: string): boolean => {
            try {
                const parsedUrl = new URL(url);
                return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
            } catch (_) {
                return false;
            }
        };

        const regexMarkdown = /(?=\[(!\[.+?]\(.+?\)|.+?)]\((https:\/\/[^)]+)\))/gi;
        const match = [...(card.desc ?? '').matchAll(regexMarkdown)].map((m) => m[1])[0]?.trim();

        const url = isUrl(match) ? match : card.desc ?? '';

        if (!card.desc || !isUrl(url)) {
            return {
                ...this.parseBasePoster(card, checklists, borrelMode),
                type: PosterType.ERROR,
                message: 'Card description does not exist or is not a valid HTTP/HTTPS URL',
            };
        }
        return {
            ...this.parseBasePoster(card, checklists, borrelMode),
            type: PosterType.EXTERNAL,
            source: [url || ''],
        };
    }

    async fetchPosters(): Promise<Poster[]> {
        // const lists = await this.client.default
        // .getBoardsIdLists(process.env.TRELLO_BOARD_ID || '', ViewFilter.ALL, 'all');
        let board = await DefaultService.getBoardsId({
            id: process.env.TRELLO_BOARD_ID || ''
        })
        if (!Object.prototype.hasOwnProperty.call(board, 'id')) throw new Error(JSON.stringify(board));
        board = board as Board;
        const { cards, lists } = board;
        if (!cards || !lists) throw new Error('Could not find cards and/or lists on the given board');

        const basePosterListName = process.env.TRELLO_BASE_POSTER_LIST_NAME ?? 'BasePosters';

        const list = lists.find((l) => l.name === basePosterListName);
        if (!list) throw new Error(`Could not find the list called "${basePosterListName}"`);

        this._posters = await this.parseLists(list, board);

        if (this.refreshTimeout) clearTimeout(this.refreshTimeout);
        this.refreshTimeout = setTimeout(this.fetchPosters.bind(this), DEFAULT_POSTER_REFRESH);

        return this._posters;
    }

    /**
     * @inheritDoc
     */
    public get posters(): Poster[] | undefined {
        if (!this._posters) return undefined;
        return this._posters.map((p): Poster => {
            if (p.type === PosterType.IMAGE || p.type === PosterType.VIDEO) {
                return {
                    ...p,
                    source: p.source.map((s) => `/static${s.replaceAll('\\', '/')}`),
                };
            }
            return p;
        });
    }
}