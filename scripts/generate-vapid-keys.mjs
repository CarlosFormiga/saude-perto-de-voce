const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const base64url = (bytes) => Buffer.from(bytes).toString("base64url");
const values = [
  `VAPID_PUBLIC_KEY=${base64url(publicRaw)}`,
  `VAPID_PRIVATE_KEY=${privateJwk.d}`,
  "VAPID_SUBJECT=mailto:contato-oficial-do-municipio@exemplo.gov.br",
];

const outputIndex = process.argv.indexOf("--out");
if (outputIndex >= 0 && process.argv[outputIndex + 1]) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(process.argv[outputIndex + 1], `${values.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  process.exit(0);
}

console.log(values.join("\n"));
console.log("\nGuarde a chave privada somente no cofre de segredos da hospedagem. Ajuste o contato oficial antes de usar.");
