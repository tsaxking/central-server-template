import { Client, Server, type Events } from './tcp';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { attemptAsync } from '../ts-utils/check';
import { decode, encode } from '../ts-utils/text';
import { lock } from 'proper-lockfile';

class EventFileManager {
    private static streams: Map<string, fs.WriteStream> = new Map();

    static getStream(filePath: string): fs.WriteStream {
        if (!this.streams.has(filePath)) {
            const stream = fs.createWriteStream(filePath, { flags: 'a' });
            this.streams.set(filePath, stream);

            stream.on('close', () => {
                this.streams.delete(filePath);
            });
        }
        return this.streams.get(filePath)!;
    }

    static closeStream(filePath: string) {
        const stream = this.streams.get(filePath);
        if (stream) {
            stream.close();
            this.streams.delete(filePath);
        }
    }
}

export class ServerAPI {
    private readonly eventFilePath: string;

    constructor(
        public readonly server: Server,
        public readonly apiKey: string
    ) {
        this.eventFilePath = path.join(__dirname, 'api', `${this.apiKey}.eventstream`);
    }

    public async init() {
        return attemptAsync(async () => {
            await fs.promises.mkdir(path.join(__dirname, 'api'), { recursive: true });
            await fs.promises.writeFile(this.eventFilePath, '', { flag: 'a' });

            this.listen('connect', () => {
                this.replayEvents();
            });
        });
    }

    listen<T extends keyof Events>(event: T, cb: (data: Events[T]) => void, zod?: z.ZodType<Events[T]>) {
        this.server.listenTo(this.apiKey, event, cb, zod);
    }

    async send(event: string, data?: unknown, timestamp?: number) {
        const state = this.server.getState(this.apiKey);
        if (state !== 'connected') {
            this.writeEventToFile(event, data, timestamp || Date.now());
            return;
        }
        this.server.sendTo(this.apiKey, event, data, timestamp || Date.now());
    }

    private async writeEventToFile(event: string, data: unknown, timestamp: number) {
        const lockRelease = await lock(this.eventFilePath);
        try {
            const stream = EventFileManager.getStream(this.eventFilePath);
            stream.write(encode(JSON.stringify({ event, data, timestamp }) + '\n'));
        } catch (err) {
            console.error('Failed to write event to file:', err);
        } finally {
            await lockRelease();
        }
    }

    private async replayEvents() {
        const lockRelease = await lock(this.eventFilePath);

        try {
            const fileContent = await fs.promises.readFile(this.eventFilePath, 'utf-8');
            const lines = fileContent.split('\n').filter(Boolean);
            const unprocessedEvents: string[] = [];

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(decode(line));
                    const event = z.object({ event: z.string(), data: z.any(), timestamp: z.number() }).parse(parsed);
                    this.send(event.event, event.data, event.timestamp);
                } catch (err) {
                    console.error('Failed to process event:', err);
                    unprocessedEvents.push(line);
                }
            }

            // Rewrite file with unprocessed events
            await fs.promises.writeFile(this.eventFilePath, unprocessedEvents.join('\n') + '\n', 'utf-8');
        } catch (err) {
            console.error('Error replaying events:', err);
        } finally {
            await lockRelease();
        }
    }
}

export class ClientAPI {
    private readonly eventFilePath: string;

    constructor(
        public readonly client: Client,  // Use Client instead of Server
        public readonly apiKey: string
    ) {
        this.eventFilePath = path.join(__dirname, 'api', `${this.apiKey}.eventstream`);
    }

    public async init() {
        return attemptAsync(async () => {
            await fs.promises.mkdir(path.join(__dirname, 'api'), { recursive: true });
            await fs.promises.writeFile(this.eventFilePath, '', { flag: 'a' });

            this.listen('connect', () => {
                this.replayEvents();
            });
        });
    }

    listen<T extends keyof Events>(event: T, cb: (data: Events[T]) => void, zod?: z.ZodType<Events[T]>) {
        this.client.listen(event, cb, zod);
    }

    async send(event: string, data?: unknown, timestamp?: number) {
        const state = this.client.connected ? 'connected' : 'disconnected';  // Use `client.connected` directly
        if (state !== 'connected') {
            this.writeEventToFile(event, data, timestamp || Date.now());
            return;
        }
        this.client.send(event, data, timestamp || Date.now());
    }

    private async writeEventToFile(event: string, data: unknown, timestamp: number) {
        const lockRelease = await lock(this.eventFilePath);
        try {
            const stream = EventFileManager.getStream(this.eventFilePath);
            stream.write(encode(JSON.stringify({ event, data, timestamp }) + '\n'));
        } catch (err) {
            console.error('Failed to write event to file:', err);
        } finally {
            await lockRelease();
        }
    }

    private async replayEvents() {
        const lockRelease = await lock(this.eventFilePath);

        try {
            const fileContent = await fs.promises.readFile(this.eventFilePath, 'utf-8');
            const lines = fileContent.split('\n').filter(Boolean);
            const unprocessedEvents: string[] = [];

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(decode(line));
                    const event = z.object({ event: z.string(), data: z.any(), timestamp: z.number() }).parse(parsed);
                    this.send(event.event, event.data, event.timestamp);
                } catch (err) {
                    console.error('Failed to process event:', err);
                    unprocessedEvents.push(line);
                }
            }

            // Rewrite file with unprocessed events
            await fs.promises.writeFile(this.eventFilePath, unprocessedEvents.join('\n') + '\n', 'utf-8');
        } catch (err) {
            console.error('Error replaying events:', err);
        } finally {
            await lockRelease();
        }
    }
}
