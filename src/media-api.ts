// subset of https://w3c.github.io/mediacapture-record/
declare global {
  interface MediaRecorderEventMap {
    "dataavailable": BlobEvent;
  }

  class MediaRecorder extends EventTarget {
    static isTypeSupported(type: string): boolean;
    constructor(stream: MediaStream, options?: MediaRecorderOptions);
    readonly videoBitsPerSecond: number;
    readonly audioBitsPerSecond: number;

    start(timeslice?: number): void;
    stop(): void;
    requestData(): void;

    addEventListener<K extends keyof MediaRecorderEventMap>(type: K, listener: (this: MediaRecorder, ev: MediaRecorderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  }

  interface MediaRecorderOptions {
    mimeType?: string;
    audioBitsPerSecond?: number;
    videoBitsPerSecond?: number;
  }

  interface BlobEvent extends Event {
    readonly data: Blob;
    readonly timecode?: DOMHighResTimeStamp;
  }
}

// subset of https://w3c.github.io/mediacapture-screen-share/
declare global {
  interface MediaDevices {
    getDisplayMedia(constraints?: DisplayMediaStreamConstraints): Promise<MediaStream>;
  }

  interface DisplayMediaStreamConstraints {
    video?: boolean | MediaTrackConstraints;
    audio?: boolean | MediaTrackConstraints;
  }

  interface MediaTrackConstraintSet {
    cursor?: "never" | "always" | "motion";
  }
}

export {};
