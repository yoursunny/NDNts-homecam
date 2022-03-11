import { connectToNetwork } from "@ndn/autoconfig";
import { Endpoint } from "@ndn/endpoint";
import { Certificate, CertNaming, generateSigningKey, KeyChain, ValidityPeriod } from "@ndn/keychain";
import { CaProfile, ClientNopChallenge, requestCertificate } from "@ndn/ndncert";
import { enableNfdPrefixReg } from "@ndn/nfdmgmt";
import { type Signer, Data, Name } from "@ndn/packet";
import { Decoder } from "@ndn/tlv";

export function isID(id: string): boolean {
  return /^\d{9}$/.test(id);
}

const keyChain = KeyChain.open("homecam");
const state = {
  sysPrefix: new Name("/localhost"),
  myID: "000000000",
  dataSigner: {} as unknown as Signer,
};

export function getState() {
  return state;
}

async function openUplink() {
  const faces = await connectToNetwork({
    fch: {
      // yoursunny ndn6 network does not yet support prefix announcement
      server: "https://ndn-fch.named-data.net",
      count: 4,
    },
    connectTimeout: 5000,
    fallback: ["hobo.cs.arizona.edu", "ndn-testbed.ewi.tudelft.nl", "uum.testbed.named-data.net"],
  });
  return faces[0];
}

async function requestCert(profile: CaProfile): Promise<Certificate> {
  state.myID = Math.floor(Math.random() * 999999999).toString(10).padStart(9, "0");
  const subjectName = state.sysPrefix.append(state.myID);
  const [privateKey, publicKey] = await generateSigningKey(keyChain, subjectName);
  const cert = await requestCertificate({
    profile,
    publicKey,
    privateKey,
    validity: ValidityPeriod.MAX,
    challenges: [new ClientNopChallenge()],
  });
  await keyChain.insertCert(cert);
  return cert;
}

function enablePing(endpoint: Endpoint) {
  endpoint.produce(state.sysPrefix.append(state.myID, "ping"), async (interest) => {
    const data = new Data(interest.name, Data.FreshnessPeriod(1));
    await state.dataSigner.sign(data);
    return data;
  });
}

export async function connect(onConsumerAvailable?: () => void) {
  const [profile, face] = await Promise.all([
    (async () => {
      const resp = await fetch("profile.data");
      const wire = new Uint8Array(await resp.arrayBuffer());
      const data = new Decoder(wire).decode(Data);
      return CaProfile.fromData(data);
    })(),
    openUplink(),
  ]);

  state.sysPrefix = profile.prefix.append("homecam");
  onConsumerAvailable?.();

  const list = await keyChain.listCerts(state.sysPrefix);
  let userCert: Certificate | undefined;
  for (const certName of list) {
    const cert = await keyChain.getCert(certName);
    const subjectName = CertNaming.toSubjectName(cert.name);
    let id: string;
    if (subjectName.length === state.sysPrefix.length + 1 &&
        isID((id = subjectName.get(-1)!.text)) &&
        cert.validity.includes(Date.now() + 1800000)) {
      userCert = cert;
      state.myID = id;
      break;
    }
  }
  if (!userCert) {
    userCert = await requestCert(profile);
  }
  state.dataSigner = await keyChain.getSigner(userCert.name);

  enableNfdPrefixReg(face, {
    signer: state.dataSigner,
    preloadCertName: userCert.name,
    preloadFromKeyChain: keyChain,
  });

  const endpoint = new Endpoint({
    announcement: state.sysPrefix.append(state.myID),
  });
  enablePing(endpoint);
}
