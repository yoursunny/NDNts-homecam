import { Metadata } from "@ndn/rdr";
import { Extension, NNI } from "@ndn/tlv";

const [HomecamMetadata_, HomecamMetadataExtensions] = Metadata.makeExtensible("HomcamMetadata");

const TtInitVersion = 0xA55C;

HomecamMetadataExtensions.registerExtension<number>({
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

export const HomecamMetadata = HomecamMetadata_;

export namespace HomecamMetadataInitVersion {
  export function get(m: Metadata): number {
    return (Extension.get(m as any, TtInitVersion) as number | undefined) ?? 0;
  }

  export function set(m: Metadata, v: number): void {
    Extension.set(m as any, TtInitVersion, v);
  }
}

// export class HomecamMetadata extends HomecamMetadataBase {
//   public get initVersion(): number {
//     return (Extension.get(this, TtInitVersion) as number | undefined) ?? 0;
//   }

//   public set initVersion(v: number) {
//     Extension.set(this, TtInitVersion, v);
//   }
// }
