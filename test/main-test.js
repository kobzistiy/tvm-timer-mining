import { expect } from "chai";
import { Contract, Signer, zeroAddress } from "locklift";
import { FactorySource } from "../build/factorySource";
const Config = require("../utils/config.js");  

let manager;
let signer;
let dest = '0:1111111111111111111111111111111111111111111111111111111111111111';
let delay = 5;

function timerStart(period) {
  return (Math.floor(Date.now() / 1000 / period) + 1) * period;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Test contract", async function () {
  before(async () => {
    signer = (await locklift.keystore.getSigner("0"));
  });
  describe("Contracts", async function () {
    it("Load contract factory", async function () {
      const sampleData = await locklift.factory.getContractArtifacts("TimerManager");
      Config.updConf({codeHash: sampleData.codeHash})

      expect(sampleData.code).not.to.equal(undefined, "Code should be available");
      expect(sampleData.abi).not.to.equal(undefined, "ABI should be available");
      expect(sampleData.tvc).not.to.equal(undefined, "tvc should be available");
    });

    it("Deploy contract", async function () {
      const { contract } = await locklift.tracing.trace(locklift.factory.deployContract({
        contract: "TimerManager",
        publicKey: signer.publicKey,
        initParams: {
          _nonce: locklift.utils.getRandomNonce(),
          _owner: zeroAddress
        },
        constructorParams: {
        },
        value: locklift.utils.toNano(2),
      }));
      manager = contract;
      console.log('manager', manager.address.toString());

      expect(await locklift.provider.getBalance(manager.address).then(balance => Number(balance))).to.be.above(0);
    });

    it("set Event", async function () {

      await manager.methods.setEvent({
          dest: dest,
          payload: '',
          delay: delay,
          next: timerStart(delay),
          reward: 0.01 * 1e9,
          active: true
      }).sendExternal({ publicKey: signer.publicKey });

      const res = await manager.methods.getDetails({}).call();
      console.log('getDetails', res);
      
      expect(res.active).to.be.equal(true, "Wrong state");
    });

    it("try callTimer false", async function () {

      await manager.methods.callTimer({
          miner: dest,
      }).sendExternal({ publicKey: signer.publicKey });

      const res = await manager.methods.getDetails({}).call();
      console.log('getDetails', res);
      
      expect(res.active).to.be.equal(true, "Wrong state");
    });

    it("try callTimer true", async function () {

      await sleep(delay*1000);
      await manager.methods.callTimer({
          miner: dest,
      }).sendExternal({ publicKey: signer.publicKey });

      const res = await manager.methods.getDetails({}).call();
      console.log('getDetails', res);
      
      expect(res.active).to.be.equal(true, "Wrong state");
    });

  });
});
