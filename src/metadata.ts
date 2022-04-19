import { Metadata } from "@ndn/rdr";
import { Extensible, Extension, ExtensionRegistry, NNI } from "@ndn/tlv";
import { toUtf8 } from "@ndn/util";

const TtMimeType = 0x8301;
const TtTimeSlice = 0x8303;
const TtSeqNum = 0x8305;

const EXTENSIONS = new ExtensionRegistry();
EXTENSIONS.registerExtension<string>({
  tt: TtMimeType,
  decode(obj, { text }) {
    void obj;
    return text;
  },
  encode(obj, value) {
    void obj;
    return [TtMimeType, toUtf8(value)];
  },
});
EXTENSIONS.registerExtension<number>({
  tt: TtTimeSlice,
  decode(obj, { nni }) {
    void obj;
    return nni;
  },
  encode(obj, value) {
    void obj;
    return [TtTimeSlice, NNI(value)];
  },
});
EXTENSIONS.registerExtension<number>({
  tt: TtSeqNum,
  decode(obj, { nni }) {
    void obj;
    return nni;
  },
  encode(obj, value) {
    void obj;
    return [TtSeqNum, NNI(value)];
  },
});

@Metadata.extend
export class HomecamMetadata extends Metadata implements Extensible {
  public readonly [Extensible.TAG] = EXTENSIONS;

  /** Media clip MIME type. */
  public get mimeType(): string {
    return (Extension.get(this, TtMimeType) as string | undefined) ?? "";
  }

  public set mimeType(v: string) {
    Extension.set(this, TtMimeType, v);
  }

  /** Duration of each clip in milliseconds. */
  public get timeSlice(): number {
    return (Extension.get(this, TtTimeSlice) as number | undefined) ?? 0;
  }

  public set timeSlice(v: number) {
    Extension.set(this, TtTimeSlice, v);
  }

  /** Current sequence number. */
  public get seqNum(): number {
    return (Extension.get(this, TtSeqNum) as number | undefined) ?? 0;
  }

  public set seqNum(v: number) {
    Extension.set(this, TtSeqNum, v);
  }
}
