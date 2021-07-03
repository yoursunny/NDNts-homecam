import { Metadata } from "@ndn/rdr";
import { Extensible, Extension, ExtensionRegistry, NNI } from "@ndn/tlv";

const TtInitVersion = 0xA55C;

const EXTENSIONS = new ExtensionRegistry();
EXTENSIONS.registerExtension<number>({
  tt: TtInitVersion,
  decode(obj, tlv) {
    void obj;
    return tlv.nni;
  },
  encode(obj, value) {
    void obj;
    return [TtInitVersion, NNI(value)];
  },
});

@Metadata.extend
export class HomecamMetadata extends Metadata implements Extensible {
  public readonly [Extensible.TAG] = EXTENSIONS;

  public get initVersion(): number {
    return (Extension.get(this, TtInitVersion) as number | undefined) ?? 0;
  }

  public set initVersion(v: number) {
    Extension.set(this, TtInitVersion, v);
  }
}
