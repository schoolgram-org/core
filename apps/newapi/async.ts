import { AsyncClient } from 'httpx';
import { TimeoutError } from 'asyncio';
import { NoResponseFromServer } from 'netschoolapi/errors';

const DEFAULT_REQUESTS_TIMEOUT = 5;

type Requester = (request: Request, followRedirects?: boolean) => Promise<any>;

class AsyncClientWrapper {
    private client: AsyncClient;
    private _defaultRequestsTimeout: number;

    constructor(asyncClient: AsyncClient, defaultRequestsTimeout?: number) {
        this.client = asyncClient;
        this._defaultRequestsTimeout = defaultRequestsTimeout ?? DEFAULT_REQUESTS_TIMEOUT;
    }

    makeRequester(requestsTimeout?: number): Requester {
        return (request: Request, followRedirects: boolean = false) => this.request(requestsTimeout, request, followRedirects);
    }

    async request(requestsTimeout: number | undefined, request: Request, followRedirects: boolean = false): Promise<any> {
        if (requestsTimeout === undefined) {
            requestsTimeout = this._defaultRequestsTimeout;
        }
        try {
            if (requestsTimeout === 0) {
                return await this._infiniteRequest(request, followRedirects);
            } else {
                return await Promise.race([
                    this._infiniteRequest(request, followRedirects),
                    new Promise((_, reject) => setTimeout(() => reject(new TimeoutError()), requestsTimeout * 1000))
                ]);
            }
        } catch (error) {
            if (error instanceof TimeoutError) {
                throw new NoResponseFromServer();
            }
            throw error;
        }
    }

    private async _infiniteRequest(request: Request, followRedirects: boolean): Promise<any> {
        while (true) {
            try {
                return await this.client.send(request, { followRedirects });
            } catch (error) {
                if (error instanceof ReadTimeout) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw error;
                }
            }
        }
    }
}
