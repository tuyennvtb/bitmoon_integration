import {
	ChainId,
	WETH,
	Token,
	Fetcher,
	Route,
	Trade,
	TokenAmount,
	TradeType,
	Percent,
	Pair,
	IERC20
} from '@uniswap/sdk';
import Web3 from 'web3';
import Big from 'big.js';
import { tasks, env, logger, service } from '../config';
import ERC20Coins from '../core/Coins/ERC20Coins';
import Worker from '../core/Worker';
import Util from '../core/Util';

class UniswapController {
	constructor(req, res) {
		if (!req || !res) {
			throw new Error('Please setup the Request/Response for Controller.');
		}
		this.request = req;
		this.response = res;
		this.worker = new Worker({
			mode: env,
		});
		this.api = service.erc20.network.livenet;
		this.abiArray = service.uniswap.abiArray;
		this.uniswapV2Contract = service.uniswap.contractAddress;

		/*
		this.hakkaAbi = service.hakka.abiArray;
		this.hakkaTokensAddress = service.hakka.contractAddress;
		this.usdtAbi = service.usdterc20.abiArray;
		this.usdtTokensAddress = service.usdterc20.contractAddress;
		*/
	}

	getBody = () => this.request.body;

	getParam = query => (query && query in this.request.params && this.request.params[query]) || null;

	createTransaction = async () => {
		console.log('-----------------Request info-------------');
		const requestBody = this.getBody();
		let responseData = {
			status: 200,
			data: {},
			success: false
		};
		if (requestBody) {
			const bodyData = requestBody;

			/** From information */
			const fromCoinID = bodyData.from_coin_id || null;
			const fromCoinCode = bodyData.from_coin_code || null;
			const fromCoinDecimals = bodyData.from_coin_decimal || 18;
			const requestAmountIn = bodyData.amount_in || null;
			const fromTokenContract = bodyData.from_token_contract || null;

			/** To information */
			const toCoinID = bodyData.to_coin_id || null;
			const toCoinCode = bodyData.to_coin_code || null;
			const toCoinDecimals = bodyData.to_coin_decimal || 18;
			const toTokenContract = bodyData.to_tokens_contract || null;
			const toAddress = bodyData.to_address || null;
			const requestAmountOutMinimum = bodyData.min_amount_out || null;

			/** Onwer */
			const ownerAddress = bodyData.owner_address || null;
			const ownerPrivateKey = bodyData.owner_private_key || null;

			if (!fromCoinID || !fromCoinCode || !fromCoinDecimals || !requestAmountIn || !fromTokenContract || !toTokenContract || !toCoinID || !toCoinCode || !toCoinDecimals || !toAddress || !ownerAddress || !ownerPrivateKey) {
				console.log(`${fromCoinID} || ${fromCoinCode} || ${fromCoinDecimals} || ${requestAmountIn} || ${fromTokenContract} || ${toTokenContract} || ${toCoinID} || ${toCoinCode} || ${toCoinDecimals} || ${toAddress} || ${ownerAddress} || ${ownerPrivateKey}`);
				this.response.json({
					status: false,
					reason: 'WRONG_INPUT'
				});
				return false;
			}
			let swapTranasction = {};
			if (fromCoinID.toLowerCase() == 'ethereum') {
				//eth to tokens
				console.log(`start to swap eth to token`);
				swapTranasction = await this.swapETHToTokens({
					requestAmountIn
				}, {
					tokenAddress: toTokenContract,
					coinCode: toCoinCode,
					decimal: toCoinDecimals,
					minAmountOut: requestAmountOutMinimum,
					toAddress: toAddress,
					coinId: toCoinID
				}, {
					ownerAddress: ownerAddress,
					privateKey: ownerPrivateKey
				});
			} else if (toCoinID == 'ethereum') {
				//tokens to eth
				//swapTranasction = await this.swapTokensToETH();
				console.log(`start to swap tokens to eth`);
				swapTranasction = await this.swapTokensToETH({
					requestAmountIn: requestAmountIn,
					tokenAddress: fromTokenContract,
					coinCode: fromCoinCode,
					coinId: fromCoinID,
					decimal: fromCoinDecimals,
				}, {
					toAddress: toAddress,
					coinId: toCoinID,
					minAmountOut: requestAmountOutMinimum,
				}, {
					ownerAddress: ownerAddress,
					privateKey: ownerPrivateKey
				});
			}
			responseData.success = swapTranasction.status;
			responseData.data = swapTranasction.data;
		}
		this.response.json(responseData);
	}
	/**
	 * Fromobject {
	 * 	amountIn
	 * }
	 * ToObject {
	 * 	tokenAddress, coinCode, coinId, decimal, minAmountOut, toAddress
	 * }
	 * OwnerObject {
	 * 	ownerAddress, privateKey
	 * }
	 */
	swapETHToTokens = async (fromObject, toObject, ownerObject) => {
		const response = {
			status: false,
			reason: null,
			txid: null
		};
		/** From informamtion */
		const requestAmountIn = fromObject.requestAmountIn || null;

		/** To informmation */
		const tokensAddress = toObject.tokenAddress || null;
		const coinCode = toObject.coinCode || null; // HAKKA
		const coinId = toObject.coinId || null; // hakka-finance
		const decimals = toObject.decimal || null;
		const requestAmountOutMinimum = toObject.minAmountOut || null;
		const toAddress = toObject.toAddress || null;

		/** Owner information */
		const ownerAddress = ownerObject.ownerAddress || null;
		const ownerPrivateKey = ownerObject.privateKey || null;

		if (!tokensAddress || !coinCode || !coinId || !decimals || !requestAmountIn || !ownerAddress || !ownerPrivateKey || !toAddress) {
			response.status = false;
			response.reason = 'WRONG_INPUT';
			return response;
		}
		const chainId = ChainId.MAINNET;
		const token = new Token(
			ChainId.MAINNET,
			tokensAddress,
			decimals,
			coinCode,
			coinId
		);
		const web3 = new Web3(new Web3.providers.HttpProvider(this.api));

		const pair = await Fetcher.fetchPairData(token, WETH[token.chainId])
		const route = new Route([pair], WETH[token.chainId]);
		const amountIn = web3.utils.toWei(requestAmountIn.toString(), 'ether');
		const trade = new Trade(
			route,
			new TokenAmount(WETH[token.chainId], amountIn),
			TradeType.EXACT_INPUT,
		);
		const slippageTolerance = new Percent('2000', '10000'); // 50 bips, or 0.50%
		/*
		const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
		console.log(`mmin`);
		console.log(amountOutMin);
		const amountminHex = web3.utils.toHex(amountOutMin);
		console.log(`min hex`);
		console.log(amountminHex);
		*/
		//const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
		//const amountOutMin = Big(route.midPrice.toSignificant(6)).times(requestAmountIn).times(80).div(100).toFixed(0).toString();
		if (!requestAmountOutMinimum) {
			//if not set the require min output, let get the 95% mins
			requestAmountOutMinimum = Big(route.midPrice.toSignificant(6)).times(requestAmountIn).times(95).div(100).toFixed(0).toString();
		}
		const amountminHex = web3.utils.toHex(requestAmountOutMinimum);
		const path = [WETH[token.chainId].address, token.address];
		const deadline = Math.floor(Date.now() / 1000) + 6000 * 20; // 20 minutes from the current Unix time
		const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex

		const contract = await new web3.eth.Contract(
			this.abiArray,
			this.uniswapV2Contract,
			{ from: ownerAddress },
		);

		const contractDaTa = contract.methods
			.swapExactETHForTokens(amountminHex, path, toAddress, deadline)
			.encodeABI();
		//start to send coin
		const erc20Coins = new ERC20Coins({
			abiArray: this.abiArray,
			contractAddress: this.uniswapV2Contract,
			tokenSymbol: "",
			coinCode: "ETH"
		});
		const decryptoSecret = Util.decrypt(ownerPrivateKey);
		const sendCoins = await erc20Coins.sendBalance({
			wallet_address: ownerAddress,
			master_key: decryptoSecret
		}, {
			data: contractDaTa,
			amount: amountIn
		}
		);
		return sendCoins;
	};
	/**
	 * Fromobject {
	 * 	amountIn, tokenAddress, coinCode, coinId, decimal
	 * }
	 * ToObject {
	 * 	minAmountOut, toAddress
	 * }
	 * OwnerObject {
	 * 	ownerAddress, privateKey
	 * }
	 */
	swapTokensToETH = async (fromObject, toObject, ownerObject) => {
		const response = {
			status: false,
			reason: null,
			txid: null
		};
		/** From informamtion */
		const requestAmountIn = fromObject.requestAmountIn || null;
		const decimals = fromObject.decimal || null;
		const tokensAddress = fromObject.tokenAddress || null;
		const coinCode = fromObject.coinCode || null; // HAKKA
		const coinId = fromObject.coinId || null; // hakka-finance

		/** To informmation */
		let requestAmountOutMinimum = toObject.minAmountOut || null;
		const toAddress = toObject.toAddress || null;

		/** Owner information */
		const ownerAddress = ownerObject.ownerAddress || null;
		const ownerPrivateKey = ownerObject.privateKey || null;
		if (!tokensAddress || !coinCode || !coinId || !decimals || !requestAmountIn || !ownerAddress || !ownerPrivateKey || !toAddress) {
			response.status = false;
			response.reason = 'WRONG_INPUT';
			return response;
		}
		try {
			const chainId = ChainId.MAINNET;
			const token = new Token(
				ChainId.MAINNET,
				tokensAddress,
				decimals,
				coinCode,
				coinId
			);
			const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
			const pair = await Fetcher.fetchPairData(token, WETH[token.chainId]);
			const route = new Route([pair], WETH[token.chainId]);
			//const amountIn = web3.utils.toWei(requestAmountIn.toString(), 'ether');
			const amountIn = await this.convertToTokensValue(requestAmountIn, decimals);
			const trade = new Trade(
				route,
				new TokenAmount(WETH[token.chainId], amountIn),
				TradeType.EXACT_INPUT,
			);
			//const amountIn = web3.utils.toWei(requestAmoutIn.toString(), 'ether');
			/*
			const slippageTolerance = new Percent('2000', '10000'); // 50 bips, or 0.50%
			const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
			*/
			if (!requestAmountOutMinimum) {
				//if not set the require min output, let get the 95% mins
				requestAmountOutMinimum = Big(route.midPrice.invert().toSignificant(6)).times(requestAmountIn).times(95).div(100).toFixed(10).toString();
			}
			//const amountminHex = web3.utils.toHex(requestAmountOutMinimum);
			//const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
			//const amountOutMin = Big(route.midPrice.invert().toSignificant(6)).times(requestAmountIn).times(80).div(100).toFixed(5);
			//console.log(`amount out min ${amountOutMin}`);
			//const amountminHex = web3.utils.toHex(Big(amountOutMin));
			//const amountminHex = web3.utils.toHex(Big("0.000004"));
			//allow 20% risk
			const amountminHex = web3.utils.toWei(`${requestAmountOutMinimum}`).toString();
			//console.log(`min hex`);
			//console.log(amountminHex);

			// return;
			//console.log(DAI);
			// return;
			const path = [tokensAddress, WETH[token.chainId].address];
			//const to = owner.address; // should be a checksummed recipient address
			const to = toAddress;
			const deadline = Math.floor(Date.now() / 1000) + 6000 * 20; // 20 minutes from the current Unix time
			const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex
			const contract = await new web3.eth.Contract(
				this.abiArray,
				this.uniswapV2Contract,
				{ from: ownerAddress },
			);
			/*
			
			const hakkaContract = await new web3.eth.Contract(
			this.hakkaAbi,
			this.hakkaTokensAddress,
			{ from: ownerAddress },
			);
			console.log(`start the require ${ownerAddress} pair ${this.hakkaTokensAddress} amount in ${amountIn}`);
			//require(hakkaContract.methods.transferFrom(owner.address, this.pairContractAddress, amountIn));
	
			console.log(`start the approval`);
	
			
			try {
			/*
			const transferFrom = hakkaContract.methods.transferFrom(owner.address, this.pairContractAddress, amountIn)
			const approveStatus = await hakkaContract.methods.approve(this.pairContractAddress, amountIn);
			console.log(`approve status`);
			*/
			/*
			const approveAmount = `${amountIn}0`;
			console.log(`token ${this.hakkaTokensAddress}, ${approveAmount}`);
			
			//send approval to Hakka tokens address
			const approveEncodedABI = await hakkaContract.methods
				.approve(this.uniswapV2Contract, approveAmount)
				.encodeABI();
			//send to network
			const erc20CoinsHakka = new ERC20Coins({
				abiArray: this.abiArray,
				contractAddress: this.hakkaTokensAddress,
				tokenSymbol: "",
				coinCode: "HAKKA"
			});
			const sendHakka = await erc20CoinsHakka.sendBalance({
				wallet_address: ownerAddress,
				master_key: decryptoSecret
			}, {
				data: approveEncodedABI,
				amount: 0
				});
	
			} catch (e) {
			console.log(`got error`);
			console.log(e);
			}
	
			*/
			const decryptoSecret = Util.decrypt(ownerPrivateKey);
			const contractDaTa = contract.methods
				.swapExactTokensForETH(amountIn, amountminHex, path, to, deadline)
				.encodeABI();
			//start to send coin
			const erc20Coins = new ERC20Coins({
				abiArray: this.abiArray,
				contractAddress: this.uniswapV2Contract,
				tokenSymbol: "",
				coinCode: "ETH"
			});
			const sendCoins = await erc20Coins.sendBalance({
				wallet_address: ownerAddress,
				master_key: decryptoSecret
			}, {
				data: contractDaTa,
				amount: 0
			});
			return sendCoins;
		} catch (e) {
			console.log(e);
		}

	};

	swapUSDTToTokens = async () => {
		const { client } = this;
		console.log('-----------------Request info-------------');
		const requestBody = this.getBody();
		console.log(`The chainId of mainnet is ${ChainId.MAINNET}.`);
		if (requestBody) {
			const bodyData = requestBody;
			//const tokenAddress = '0x0e29e5abbb5fd88e28b2d355774e73bd47de3bcd'; // must be checksummed
			const tokensAddress = bodyData.token_address || null;
			const coinCode = bodyData.coin_code || null; // HAKKA
			const coinId = bodyData.coin_id || null; // hakka-finance
			const decimals = bodyData.decimal || 18;
			const requestAmountIn = bodyData.amount_in || 0.1;
			const allowRisk = bodyData.allow_risk || 90;
			const requireMinOut = bodyData.require_min_out || null;

			const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7";
			const owner = {
				address: "0x8B0b7d7d13B6C262a81B507457d5F7f743875460",
				secret: "0fbbdf7590078729aa8bfb436fa401f056e008a6aa5176eb85c73374e01fb3c0"
			};
			const chainId = ChainId.MAINNET;

			const DAI = new Token(
				ChainId.MAINNET,
				tokensAddress,
				decimals,
				coinCode,
				coinId
			);

			const USDT = new Token(
				ChainId.MAINNET,
				this.usdtTokensAddress,
				6,
				"USDT",
				"tether"
			);
			//allow uniswap to send usdt
			/*
			try {
				//send approval to usdt tokens address
				const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
				const usdtContract = await new web3.eth.Contract(
				this.usdtAbi,
				this.usdtTokensAddress,
				{ from: owner.address },
				);
				console.log(`start to approve`);
				const approveEncodedABI = await usdtContract.methods
				.approve(this.pairContractAddress, 10000000000000)
				.encodeABI();
				console.log(approveEncodedABI);
				//send to network
				const erc20CoinsUsdt = new ERC20Coins({
				abiArray: this.usdtAbi,
				contractAddress: this.usdtTokensAddress,
				tokenSymbol: "",
				coinCode: "USDT"
				});
				const sendHakka = await erc20CoinsUsdt.sendBalance({
				wallet_address: owner.address,
				master_key: owner.secret
				}, {
					data: approveEncodedABI,
					amount: 0
				});
	  
			} catch (e) {
				console.log(`got error`);
				console.log(e);
			}
			return;
			*/

			const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
			// const pair = "0xa2107fa5b38d9bbd2c461d6edf11b11a50f6b974";
			let amountminHex;
			const amountIn = requestAmountIn * 1000000;
			let numberOfZero = 1;
			for (let i = 0; i < DAI.decimals; i++) {
				numberOfZero = `${numberOfZero}0`;
			}
			if (!requireMinOut) {
				const pair = await Fetcher.fetchPairData(DAI, USDT);
				console.log(`pair info`);
				const route = new Route([pair], USDT);

				console.log(`price 1 ${DAI.symbol} PRICE is ${route.midPrice.invert().toSignificant(6)}`); // 201.306
				console.log(route.midPrice.toSignificant(6)); // 0.00496756


				//const amountIn = '1000000000000000000'; // 1 WETH
				//const amountIn = web3.utils.toWei(requestAmountIn.toString(), 'ether');

				/*
				const trade = new Trade(
					route,
					new TokenAmount(WETH[DAI.chainId], amountIn),
					TradeType.EXACT_INPUT,
				);
				const slippageTolerance = new Percent('2000', '10000'); // 50 bips, or 0.50%
				*/

				//const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
				/*
				console.log(`mmin`);
				console.log(amountOutMin);
				const amountminHex = web3.utils.toHex(amountOutMin);
				console.log(`min hex`);
				console.log(amountminHex);
				*/

				console.log(`number ${numberOfZero}`);
				//const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
				const amountOutMin = Big(route.midPrice.toSignificant(6)).times(requestAmountIn).times(allowRisk).div(100).toFixed(0).toString();
				console.log(`amount out min ${amountOutMin}`);
				const amountOutMinGwei = web3.utils.toWei(amountOutMin.toString(), 'ether');
				amountminHex = web3.utils.toHex(amountOutMinGwei);
				console.log(`min hex ${amountminHex}`);
				//return;
			} else {
				console.log(`receive the min require from params instead`);
				const amountOutMin = web3.utils.toWei(requireMinOut.toString(), 'ether');
				amountminHex = web3.utils.toHex(`${amountOutMin}`);
				console.log(amountminHex);
				//return;
			}
			const path = [usdtAddress, DAI.address];

			const to = owner.address; // should be a checksummed recipient address
			const deadline = Math.floor(Date.now() / 1000) + 6000 * 20; // 20 minutes from the current Unix time
			//const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex

			const contract = await new web3.eth.Contract(
				this.abiArray,
				this.pairContractAddress,
				{ from: owner.address },
			);
			console.log(`${amountIn} hex , ${amountminHex}, path ${path}, to ${to}, dealine ${deadline}`);
			const contractDATa = contract.methods
				.swapExactTokensForTokens(amountIn, amountminHex, path, to, deadline)
				.encodeABI();
			//start to send coin
			const erc20Coins = new ERC20Coins({
				abiArray: this.abiArray,
				contractAddress: this.pairContractAddress,
				tokenSymbol: "",
				coinCode: "ETH"
			});
			const sendCoins = await erc20Coins.sendBalance({
				wallet_address: owner.address,
				master_key: owner.secret
			}, {
				data: contractDATa,
				amount: 0
			});

		}
		this.response.json({
			title: 'coinbase-notification',
			status: 200,
		});
	};

	swapTokensToUSDT = async () => {
		const { client } = this;
		console.log('-----------------Request info-------------');
		const requestBody = this.getBody();
		console.log(`The chainId of mainnet is ${ChainId.MAINNET}.`);
		if (requestBody) {
			const bodyData = requestBody;
			//const tokenAddress = '0x0e29e5abbb5fd88e28b2d355774e73bd47de3bcd'; // must be checksummed
			const tokensAddress = bodyData.token_address || null;
			const coinCode = bodyData.coin_code || null; // HAKKA
			const coinId = bodyData.coin_id || null; // hakka-finance
			const decimals = bodyData.decimal || 18;
			const requestAmountIn = bodyData.amount_in || 0.1;
			const allowRisk = bodyData.allow_risk || 90;
			const requireMinOut = bodyData.require_min_out || null;

			const usdtAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7";
			const owner = {
				address: "0x8B0b7d7d13B6C262a81B507457d5F7f743875460",
				secret: "0fbbdf7590077729aa8bfb436fa401f056e008a6aa5176eb85c73374e01fb3c0"
			};
			const chainId = ChainId.MAINNET;

			const DAI = new Token(
				ChainId.MAINNET,
				tokensAddress,
				decimals,
				coinCode,
				coinId
			);

			const USDT = new Token(
				ChainId.MAINNET,
				this.usdtTokensAddress,
				6,
				"USDT",
				"tether"
			);
			/*
			//allow uniswap to send usdt
			try {
				const tokensABI = [{ "inputs": [{ "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "symbol", "type": "string" }, { "internalType": "uint256", "name": "totalSupply", "type": "uint256" }], "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }, { "indexed": true, "internalType": "address", "name": "spender", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "from", "type": "address" }, { "indexed": true, "internalType": "address", "name": "to", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }, { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "subtractedValue", "type": "uint256" }], "name": "decreaseAllowance", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "addedValue", "type": "uint256" }], "name": "increaseAllowance", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "name", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "sender", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" }];
				//send approval to usdt tokens address
				const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
				const tokensContract = await new web3.eth.Contract(
				tokensABI,
				tokensAddress,
				{ from: owner.address },
				);
				console.log(`start to approve`);
				const amountToApprove = web3.utils.toWei("200000");
				const approveEncodedABI = await tokensContract.methods
				.approve(this.pairContractAddress, amountToApprove)
				.encodeABI();
				console.log(approveEncodedABI);
				//send to network
				const erc20CoinsUsdt = new ERC20Coins({
				abiArray: tokensABI,
				contractAddress: tokensAddress,
				tokenSymbol: "",
				coinCode: "USDT"
				});
				const sendHakka = await erc20CoinsUsdt.sendBalance({
				wallet_address: owner.address,
				master_key: owner.secret
				}, {
					data: approveEncodedABI,
					amount: 0
				});
	  
			} catch (e) {
				console.log(`got error`);
				console.log(e);
			}
			return;
	  
			*/

			const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
			// const pair = "0xa2107fa5b38d9bbd2c461d6edf11b11a50f6b974";
			let amountminHex;

			let numberOfZero = 1;
			for (let i = 0; i < DAI.decimals; i++) {
				numberOfZero = `${numberOfZero}0`;
			}
			//const amountIn = Big(requestAmountIn).times(numberOfZero).toString();
			const amountIn = web3.utils.toWei(requestAmountIn.toString(), 'ether');
			if (!requireMinOut) {
				const pair = await Fetcher.fetchPairData(DAI, USDT);
				console.log(`pair info`);
				const route = new Route([pair], USDT);

				console.log(`price 1 ${DAI.symbol} PRICE is ${route.midPrice.invert().toSignificant(6)}`); // 201.306
				console.log(route.midPrice.toSignificant(6)); // 0.00496756


				//const amountIn = '1000000000000000000'; // 1 WETH
				//const amountIn = web3.utils.toWei(requestAmountIn.toString(), 'ether');

				/*
				const trade = new Trade(
					route,
					new TokenAmount(WETH[DAI.chainId], amountIn),
					TradeType.EXACT_INPUT,
				);
				const slippageTolerance = new Percent('2000', '10000'); // 50 bips, or 0.50%
				*/

				//const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
				/*
				console.log(`mmin`);
				console.log(amountOutMin);
				const amountminHex = web3.utils.toHex(amountOutMin);
				console.log(`min hex`);
				console.log(amountminHex);
				*/

				console.log(`number ${numberOfZero}`);
				//const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
				const amountOutMin = Big(route.midPrice.invert().toSignificant(6)).times(requestAmountIn).times(allowRisk).div(100).times(1000000).toFixed(0).toString();
				console.log(`amount out min ${amountOutMin}`);
				amountminHex = web3.utils.toHex(amountOutMin);
			} else {
				console.log(`receive the min require from params instead`);
				amountminHex = web3.utils.toHex(Big(requireMinOut).times(1000000).toString());
				//return;
			}
			//return;

			//allow 20% risk
			// return;
			const path = [DAI.address, usdtAddress];

			const to = owner.address; // should be a checksummed recipient address
			const deadline = Math.floor(Date.now() / 1000) + 6000 * 20; // 20 minutes from the current Unix time
			//const value = trade.inputAmount.raw; // // needs to be converted to e.g. hex

			const contract = await new web3.eth.Contract(
				this.abiArray,
				this.pairContractAddress,
				{ from: owner.address },
			);
			console.log(`${amountIn} hex , ${amountminHex}, path ${path}, to ${to}, dealine ${deadline}`);
			const contractDATa = contract.methods
				.swapExactTokensForTokens(amountIn, amountminHex, path, to, deadline)
				.encodeABI();
			//start to send coin
			const erc20Coins = new ERC20Coins({
				abiArray: this.abiArray,
				contractAddress: this.pairContractAddress,
				tokenSymbol: "",
				coinCode: "ETH"
			});
			const sendCoins = await erc20Coins.sendBalance({
				wallet_address: owner.address,
				master_key: owner.secret
			}, {
				data: contractDATa,
				amount: 0
			});

		}
		this.response.json({
			title: 'coinbase-notification',
			status: 200,
		});
	};

	estimateTokensPriceByUSDT = async () => {
		console.log('-----------------Request info-------------');
		const requestBody = this.getBody();
		console.log(`The chainId of mainnet is ${ChainId.MAINNET}.`);
		let price = 0;
		if (requestBody) {

			const bodyData = requestBody;
			//const tokenAddress = '0x0e29e5abbb5fd88e28b2d355774e73bd47de3bcd'; // must be checksummed
			const tokensAddress = bodyData.token_address || null;
			const coinCode = bodyData.coin_code || null; // HAKKA
			const coinId = bodyData.coin_id || null; // hakka-finance
			const decimals = bodyData.decimal || 18;


			const DAI = new Token(
				ChainId.MAINNET,
				tokensAddress,
				decimals,
				coinCode,
				coinId
			);

			const USDT = new Token(
				ChainId.MAINNET,
				this.usdtTokensAddress,
				6,
				"USDT",
				"tether"
			);

			try {
				const pair = await Fetcher.fetchPairData(DAI, USDT);
				console.log(`pair info`);
				const route = new Route([pair], USDT);

				console.log(`price 1 ${DAI.symbol} PRICE is ${route.midPrice.invert().toSignificant(6)}`); // 201.306
				console.log(route.midPrice.toSignificant(6)); // 0.00496756
				price = `price 1 ${DAI.symbol} PRICE is ${route.midPrice.invert().toSignificant(6)}`;
			} catch (e) {
				console.log(e);
			}


		}
		this.response.json({
			title: 'coinbase-notification',
			status: 200,
			price: price
		});
	}

	convertToTokensValue = async (amount, decimal) => {
		let totalDecimals = "";
		for (let i = 0; i <= (decimal - 4); i++) {
			totalDecimals = `${totalDecimals}0`;
		}
		return `${Big(amount).times(10000).toString()}${totalDecimals}`;

	}


}
export default UniswapController;
