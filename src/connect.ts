import { connectToTestbed } from "@ndn/autoconfig";
import { Endpoint } from "@ndn/endpoint";
import { Certificate, CertNaming, KeyChain, RsaPrivateKey, ValidityPeriod } from "@ndn/keychain";
import { CaProfile, ClientNopChallenge, requestCertificate } from "@ndn/ndncert";
import { enableNfdPrefixReg } from "@ndn/nfdmgmt";
import { Data, Name, Signer } from "@ndn/packet";
import { Decoder, toHex } from "@ndn/tlv";

const keyChain = KeyChain.open("homecam");
let prefix: Name|undefined;
let dataSigner: Signer|undefined;

async function openUplink() {
  const faces = await connectToTestbed({
    connectTimeout: 5000,
    count: 4,
    fchFallback: ["hobo.cs.arizona.edu", "titan.cs.memphis.edu"],
    preferFastest: true,
  });
  if (faces.length === 0) {
    throw new Error("unable to connect to NDN testbed");
  }
  const face = faces[0];
  face.addRoute(new Name("/"));
  return face;
}

async function obtainCert(profile: CaProfile, appPrefix: Name): Promise<Name> {
  const subjectName = appPrefix.append(toHex(crypto.getRandomValues(new Uint8Array(8))));
  const [privateKey, publicKey] = await RsaPrivateKey.generate(subjectName, 2048, keyChain);
  const cert = await requestCertificate({
    profile,
    publicKey,
    privateKey,
    validity: ValidityPeriod.MAX,
    challenges: [new ClientNopChallenge()],
  });
  await keyChain.insertCert(cert);
  return cert.name;
}

function publishCert(endpoint: Endpoint, cert: Certificate) {
  endpoint.produce(CertNaming.toKeyName(cert.name), async (interest) => {
    return cert.data;
  }, {
    announcement: false,
  });
}

function enablePing(endpoint: Endpoint) {
  endpoint.produce(prefix!.append("ping"), async (interest) => {
    const data = new Data(interest.name, Data.FreshnessPeriod(1));
    await dataSigner!.sign(data);
    return data;
  });
}

export async function connect(): Promise<{ prefix: Name; dataSigner: Signer }> {
  if (prefix && dataSigner) {
    return { prefix, dataSigner };
  }

  const [profile, face] = await Promise.all([
    (async () => {
      const resp = await fetch("profile.data");
      const wire = new Uint8Array(await resp.arrayBuffer());
      const data = new Decoder(wire).decode(Data);
      return CaProfile.fromData(data);
    })(),
    openUplink(),
  ]);

  const appPrefix = profile.prefix.getPrefix(-1).append("homecam");
  const list = await keyChain.listCerts(appPrefix);
  const certName = list.length > 0 ? list[0] : await obtainCert(profile, appPrefix);
  const cert = await keyChain.getCert(certName);

  prefix = CertNaming.toSubjectName(certName);
  dataSigner = await keyChain.getSigner(certName);

  const regSigner = await keyChain.getPrivateKey(CertNaming.toKeyName(certName));
  enableNfdPrefixReg(face, {
    signer: regSigner,
  });

  const endpoint = new Endpoint({
    announcement: prefix,
  });
  publishCert(endpoint, profile.cert);
  publishCert(endpoint, cert);
  enablePing(endpoint);

  return { prefix, dataSigner };
}
