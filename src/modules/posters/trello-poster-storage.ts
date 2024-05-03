import * as fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { Attachment } from '@gewis/trello-client';

export class TrelloPosterStorage {
    private readonly location: string;

    constructor(private urlLocation: string = '/posters') {
        this.location = path.join(__dirname, '../../../../public', urlLocation);
        if (!fs.existsSync(this.location)) {
            fs.mkdirSync(this.location);
        }
    }

    /**
     * Store the given attachment on the local disk.
     * @param attachment
     * @return Relative URL to get the file using HTTP(S)
     */
    public async storeAttachment(attachment: Attachment): Promise<string> {
        const extension = path.extname(attachment.name || '');
        const fileName = `${attachment.id}${extension}`;
        const fileLocationDisk = path.join(this.location, fileName);
        const fileLocationWeb = path.join(this.urlLocation, fileName);

        if (fs.existsSync(fileLocationDisk)) return fileLocationWeb;

        // New trello update
        const headers = {
            Authorization: `OAuth oauth_consumer_key="${process.env.TRELLO_KEY}", oauth_token="${process.env.TRELLO_TOKEN}"`,
        };

        return axios.get(attachment.url!, { responseType: 'stream', headers }).then(
            (response) =>
                new Promise((resolve, reject) => {
                    const fileWriter = fs.createWriteStream(fileLocationDisk);
                    response.data.pipe(fileWriter);
                    let error: Error;
                    fileWriter.on('error', (err) => {
                        error = err;
                        fileWriter.close();
                        reject(err);
                    });
                    fileWriter.on('close', () => {
                        if (!error) {
                            resolve(fileLocationWeb);
                        }
                    });
                }),
        );
    }
}