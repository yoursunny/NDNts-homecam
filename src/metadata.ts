import { SequenceNum, Version } from "@ndn/naming-convention2";
import type { Name } from "@ndn/packet";
import { Metadata } from "@ndn/rdr";
import { Extensible, Extension, ExtensionRegistry, toUtf8 } from "@ndn/tlv";

const TtMimeType = 0xB4AD;

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

@Metadata.extend
export class HomecamMetadata extends Metadata implements Extensible {
  public readonly [Extensible.TAG] = EXTENSIONS;

  public get mimeType(): string {
    return (Extension.get(this, TtMimeType) as string | undefined) ?? "";
  }

  public set mimeType(v: string) {
    Extension.set(this, TtMimeType, v);
  }

  public get versionPrefix(): Name {
    return this.name.getPrefix(-1);
  }

  public get currentVersion(): number {
    return this.name.get(-2)!.as(Version);
  }

  public get currentSequenceNum(): number {
    return this.name.get(-1)!.as(SequenceNum);
  }
}
