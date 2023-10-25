import { ethers } from 'ethers';
import 'dotenv/config';

const TerminusDIDABI = require('../abis/TerminusDID.json');
const RegistrarABI = require('../abis/Registrar.json');
const RootResolverABI = require('../abis/RootResolver.json');

async function main() {
    const NODE_URL = process.env.GOERLI_RPC_URL;
    const PRIVKEY = process.env.PRIVATE_KEY!;
    const TERMINUSDID_ADDR = process.env.TERMINUSDID_ADDR_ETH!;

    const provider = new ethers.JsonRpcProvider(NODE_URL);

    const network = await provider.getNetwork();
    const latestBlockNum = await provider.getBlockNumber();

    console.log(`== connected with blockchain ${network.name} ${network.chainId} with latest height ${latestBlockNum} ==`);

    const signer = new ethers.Wallet(PRIVKEY, provider);

    console.log(`signer: ${signer.address}`);

    const terminusDidProxy = new ethers.Contract(TERMINUSDID_ADDR, TerminusDIDABI, provider);
    const name = await terminusDidProxy.name();
    const symbol = await terminusDidProxy.symbol();
    console.log(`interact with contract ${await terminusDidProxy.getAddress()} with name ${name}, symbol ${symbol}`);
    const registrarAddr = await terminusDidProxy.registrar();
    console.log(`registrar address: ${registrarAddr}`);
    const registrar = new ethers.Contract(registrarAddr, RegistrarABI, provider);

    const totalDomains = await terminusDidProxy.totalSupply();

    // const iface = new ethers.Interface([
    //     "function any(uint256)"
    // ])

    for (let i = 0; i < totalDomains; i++) {
        const tokenId: BigInt = await terminusDidProxy.tokenByIndex(i);
        const metadata = await terminusDidProxy.getMetadata(tokenId);
        console.log(`tokenId: ${tokenId} || metadata => domain: ${metadata.domain}, did: ${metadata.did}, notes: ${metadata.notes}, allowSubdomain: ${metadata.allowSubdomain}`);

        const tags: BigInt[] = await terminusDidProxy.getTagKeys(tokenId);
        console.log(`tokenId: ${tokenId} has ${tags.length} extent keys`);
        for (let tag of tags) {
            let ret;
            ret = await registrar.getterOf(metadata.domain, tag);
            const resolver = ret.substring(0, 42);
            const selector = '0x' + ret.substring(42, 50);

            console.log(resolver, selector);

            const resolverContract = new ethers.Contract(resolver, RootResolverABI, provider);
            // console.log(resolverContract);
            const contractFuncs = resolverContract.interface.fragments;
            let value;
            for(let fragment of contractFuncs) {
                let functionFragment = <ethers.FunctionFragment> fragment;
                // console.log(functionFragment.selector);
                if (functionFragment.selector === selector) {
                    // found the method
                    const getter = resolverContract.getFunction(functionFragment);
                    value = await getter.staticCall(tokenId);
                    break;
                }
            }

            // let data = iface.encodeFunctionData("any", [tokenId]);
            // data = selector + data.substring(10);

            // const tx = new ethers.Transaction();
            // tx.to = resolver;
            // tx.data = data;
            // const gas = await provider.estimateGas(tx)
            // tx.gasLimit = gas;

            // ret = await provider.call(tx);

            console.log(`key ${tag} => value ${value}`);
        }
    }
}

main();