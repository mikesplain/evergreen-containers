const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const definition = protoLoader.loadSync(
  "/home/csi/app/csi_proto/csi-v1.9.0.proto",
  {
    defaults: true,
    enums: String,
    keepCase: true,
    longs: String,
    oneofs: true
  }
);
const csi = grpc.loadPackageDefinition(definition).csi.v1;
const client = new csi.Identity(
  "unix:///csi/csi.sock",
  grpc.credentials.createInsecure()
);

function call(method) {
  return new Promise((resolve, reject) => {
    client[method]({}, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

(async () => {
  try {
    const info = await call("GetPluginInfo");
    const probe = await call("Probe");
    if (!info.name || !info.vendor_version) {
      throw new Error(`incomplete GetPluginInfo response: ${JSON.stringify(info)}`);
    }
    if (probe.ready && probe.ready.value === false) {
      throw new Error(`CSI probe reported not ready: ${JSON.stringify(probe)}`);
    }
    console.log(`democratic-csi contract passed: ${info.name} ${info.vendor_version}`);
  } finally {
    client.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
