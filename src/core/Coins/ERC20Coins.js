import randomHex from 'randomhex';
import Big from 'big.js';
import Web3 from 'web3';
import fetch from '../fetch';
import Util from '../Util';
import { logger, service } from '../../config';

const EthereumTx = require('ethereumjs-tx').Transaction;

class ERC20Coins {
	constructor(option) {
		this.mode = option.mode || 'production';
		this.coinCode = option.coinCode.toUpperCase() || 'ETHEREUM';
		this.abiArray = option.abiArray || '';
		this.contractAddress = option.contractAddress || '';
		this.tokenSymbol = option.tokenSymbol || '';
		this.transaction_api = '';
		this.transaction_api_token = '';
		// Setup coin server
		if (this.mode === 'production' || this.mode === 'uat') {
			this.api = service.erc20.network.livenet;
		} else {
			this.api = service.erc20.network.technet;
		}
		this.gasApi = service.erc20.network.gas_api;
		this.transaction_api = service.erc20.network.transaction_api;
		this.transaction_api_token = service.erc20.network.transaction_api_token;
	}

	// start a connection to coin server
	connect = () => true;

	// start a connection to coin server
	getBalances = async address => {
		// let balance = null;
		if (!address) {
			throw new Error('Missing address.');
		}
		return await this.getBalanceFromEtherscan(address);
	};

	// return adress key and master key
	createAddress = async () => {
		let address = {
			primary: '',
			secret: '',
		};
		try {
			const randomPassSecret = randomHex(32);
			const addressData = await fetch(`${this.api}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					method: 'parity_newAccountFromSecret',
					params: [randomPassSecret, 'bitmoon'],
					id: '1',
					jsonrpc: '2.0',
				}),
			})
				.then(res => {
					if (!res.ok) {
						throw new Error(
							`Error to fetch ${this.api} Log: ${res.statusText}`,
						);
					}
					return res.json();
				})
				.catch(err => {
					throw new Error(err.message);
				});
			if (addressData.result) {
				address = {
					primary: addressData.result,
					secret: randomPassSecret.substring(2),
				};
			}
		} catch (e) {
			address = {
				primary: '',
				secret: '',
			};
		}
		return address;
	};
	// use admin wallet to send request balance from end-user to receiver
	sendBalance = async (wallet, toData) => {
		const result = {
			status: false,
			err: '',
			data: {
				txID: null 
			}
		};
		try {
			const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
			const contract = await new web3.eth.Contract(
				this.abiArray,
				this.contractAddress,
				{ from: wallet.wallet_address },
			);
			const privateKey = Buffer.from(wallet.master_key, 'hex');
			//const gasPriceFromETH = await web3.eth.getGasPrice();
			const transactionCount = await this.getTransactionCount(
				wallet.wallet_address,
			);
			const gasApiResponse = await this.getGasPrice();
			const gasPrice = await web3.utils.toWei(
				gasApiResponse.toString(),
				'gwei',
			);
			let gasPriceToUse = gasPrice;
			const rawTransaction = {
				from: wallet.wallet_address,
				gasPrice: web3.utils.toHex(gasPriceToUse),
				gasLimit: web3.utils.toHex(60000),
				data: toData.data,
				to: this.contractAddress,
				value: web3.utils.toHex(toData.amount),
				nonce: web3.utils.toHex(transactionCount),
			};
			const estimateGasBeforeSending = await this.getEstimatedFeeByTransaction(
				wallet,
				toData,
			);
			if(!estimateGasBeforeSending.status){
				logger(
					`Swap coins fail because wrong estimate gas ${JSON.stringify(estimateGasBeforeSending)} info ${JSON.stringify(rawTransaction)}`,
					'ERC20Coins.js - Function sendBalance()',
					err,
				);
				result.status=false;
				return result;
			}else{
				rawTransaction.gasLimit = web3.utils.toHex(
					Math.round(estimateGasBeforeSending.estimateGas * 1.1),
				);
				const sendingWalletETHBalance = await this.getETHBalance(
					wallet.wallet_address,
				);
				if (
					Big(sendingWalletETHBalance.amount).lt(
						estimateGasBeforeSending.estimateETHValue,
					)
				) {
					result.status=false;
					result.err = 'NOT_ENOUGH_FEE';
					result.data = {
						requireAmount: estimateGasBeforeSending.estimateETHValue,
						txID: 'TX_ID'
					};
					return result;
				}
				//start to send to ether network
				result.status=true;
				result.data.txID='0x735e52d3e5d938d5a3a2e04b293007d8ff1eac0ec08c4fec431eb4af3ace5e83';
				return result;
				try {
					const transaction = new EthereumTx(rawTransaction);
					transaction.sign(privateKey);
					try {
						const apiToRequest = `${
							this.transaction_api
							}?module=proxy&action=eth_sendRawTransaction&apikey=${
							this.transaction_api_token
							}&hex=0x${transaction.serialize().toString('hex')}`;
						const sendResult = await fetch(`${apiToRequest}`, {
							method: 'GET',
							timeout: 60000,
						})
							.then(res => res.json())
							.catch(err => {
								logger(
									`Send ${task.amount} ${wallet.coin_code} from ${
									wallet.wallet_address
									} to ${task.to_address} failed.`,
									'ERC20Coins.js - Function sendBalance()',
									err,
								);
							});
						if (sendResult && sendResult.result) {
							result.data.txID = sendResult.result;
							result.status=true;
						} else {
							result.data.txID = 'TXID';
							result.status=true;
							logger(
								`Send ${task.amount} ${wallet.coin_code} from ${
								wallet.wallet_address
								} to ${task.to_address} failed. ${JSON.stringify(
									sendResult,
								)}, url ${apiToRequest}`,
								'ERC20tokens.js - Function sendBalance()',
								'',
							);
						}
					} catch (exception) {
						result.data.txID = 'txid';
						logger(
							`Send from ${wallet.wallet_address} to failed.`,
							'ERC20coins.js - Function sendBalance()',
							'',
						);
					}
				} catch (e) {
					logger(
						`Send ${task.amount} ${wallet.coin_code} from ${
						wallet.wallet_address
						} to ${task.to_address} failed.`,
						'CoinAPI.js - Function sendBalance()',
						e,
					);
					result.err = e.message;
				}
			}
			return result;
		} catch (err) {
			logger(
				`Send data from ${wallet.wallet_address} to failed.`,
				'CoinAPI.js - Function sendBalance()',
				err.message,
			);
			result.err = err.message;
		}
	};

	// get transaction by id
	getTransaction = async id => {
		const txObj = null;
		if (!id) {
			return txObj;
		}
		return await this.getTransactionByEtherscan(id);
	};
	// get transaction by id
	getTransactionByEtherscan = async id => {
		let txObj = null;
		if (!id) {
			return txObj;
		}
		try {
			const apiToRequest = `${
				service.eth.network.transaction_api
				}?module=proxy&action=eth_getTransactionByHash&txhash=${id}&apikey=${
				service.eth.network.transaction_api_token
				}`;
			const result = await fetch(`${apiToRequest}`)
				.then(res => res.json())
				.catch(err => {
					throw new Error(err.message);
				});
			if (
				result &&
				result.result &&
				result.result.blockNumber &&
				result.result.blockHash
			) {
				txObj = result;
			} else {
				logger(
					`Not found transaction: ${id}`,
					'ERC20.js - Function getTransaction()',
				);
			}
		} catch (e) {
			txObj = null;
			logger(
				`Error to get transaction from ID: ${id}`,
				'Bitcoin.js - Function getTransaction()',
				e,
			);
		}
		return txObj;
	};

	// For Bitcoin, we hard the result of getTransactions to be all unspent transactions
	getTransactions = async (address, items) => {
		let transactionsList = '';
		try {
			const apiToRequest = `${
				service.eth.network.transaction_api
				}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${
				service.eth.network.transaction_api_token
				}`;
			transactionsList = await fetch(`${apiToRequest}`)
				.then(res => res.json())
				.catch(err => {
					throw new Error(err.message);
				});
		} catch (e) {
			logger(
				`Error to get unspent transaction from adress: ${address}`,
				'ERC20Coins.js - Function getUnspentTransaction()',
				e,
			);
		}
		return transactionsList;
	};

	// check transaction is success or not
	isSuccessTransaction = transaction => {
		let confirms = -1;
		if (transaction) {
			confirms = transaction.confirmations || -1;
		}

		return (
			confirms >= 1 && transaction.block_index && !transaction.double_spend
		);
	};

	// get transaction by id
	getConfirmations = async id => {
		let confirms = -1;
		const transaction = await this.getTransaction(id);
		if (transaction) {
			if (transaction.blockNumber) {
				// start to get current block number, minus to transaction block, will return correct confirmation
				const currentBlock = await this.getCurrentBlockNumber();
				const transactionBlock = this.getNumberFromHex(transaction.blockNumber);
				confirms = currentBlock - transactionBlock;
			}
		}
		return confirms;
	};
	// get transaction by id
	getCurrentBlockNumber = async () => {
		let blockNumber = -1;
		try {
			const apiToRequest = `${
				service.eth.network.transaction_api
				}?module=proxy&action=eth_blockNumber&apikey=${
				service.eth.network.transaction_api_token
				}`;
			const result = await fetch(`${apiToRequest}`)
				.then(res => res.json())
				.catch(err => {
					throw new Error(err.message);
				});
			if (result && result.result) {
				blockNumber = this.getNumberFromHex(result.result);
			}
		} catch (error) {
			logger(
				`Error to get current blocknumber`,
				'Bitcoin.js - Function getCurrentBlockNumber()',
				error,
			);
		}
		return blockNumber;
	};
	getNumberFromHex = hex => parseInt(hex, 16);

	// get transaction by id
	isValidTransaction = async (transaction, task) => {
		let isValid = false;
		try {
			isValid =
				transaction &&
				transaction.blockNumber &&
				transaction.to &&
				transaction.blockHash &&
				transaction.hash &&
				transaction.hash.toLowerCase() === task.tx_id.toLowerCase() &&
				transaction.coin.toLowerCase() === task.coin.toLowerCase() &&
				Big(transaction.value).eq(task.amount);
		} catch (e) {
			logger(
				`Error to check the transaction valid`,
				'Bitcoin.js - Function isValidTransaction()',
				e,
			);
			isValid = false;
		}

		return isValid;
	};
	getInputTX = transaction => {
		const accounts = [];
		transaction.inputs.forEach(input => {
			accounts.push(...input.addresses);
		});
		return accounts.filter((item, i, ar) => ar.indexOf(item) === i);
	};

	getOutputTX = transaction => {
		const destinations = [];
		const inputs = this.getInputTX(transaction);
		transaction.outputs.forEach(output => {
			destinations.push(...output.addresses);
		});
		return destinations.filter(el => !inputs.includes(el));
	};

	// get transaction fee from transaction detail
	// get fee from transaction
	// note that if it a deposit transaction we don't have fee
	// as we are the one who pay for the fee
	getTransactionFee = (transaction, type) => {
		if (transaction) {
			if (type !== 'cold') {
				return transaction && transaction.fee ? Number(transaction.fee) : 0;
			}
			return 0;
		}
		return 0;
	};
	// get transaction and format to blockchain default format
	getFormatUnspentTransactions = async address => this.getTransactions(address);

	// calculate balance to send, if deposit, send all balance
	getBalanceToSendOut = async (address, type, amount) => {
		let amountToSend = 0;
		if (type.toLowerCase() === 'deposit') {
			// getBalances
			const currentBalane = await this.getBalances(address);
			if (currentBalane && currentBalane.amount) {
				amountToSend = currentBalane.amount;
			}
		} else {
			amountToSend = amount;
		}
		return amountToSend;
	};
	getGasPrice = async () => {
		let gasPrice = 0;
		try {
			const result = await fetch(`${this.gasApi}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			})
				.then(res => res.json())
				.catch(err => {
					throw new Error(err.message);
				});
			if (result) {
				gasPrice = Big(result.fast).div(10).toString();
				//gasPrice = Big(result.safeLow).div(10).toString();
			}
		} catch (error) {
			logger(
				`Error to get current getGasPrice`,
				'ERC20coins.js - Function getGasPrice()',
				error,
			);
		}
		return await gasPrice;
	};
	getBalanceFromEtherscan = async address => {
		let balance = null;
		if (!address) {
			throw new Error('Missing address.');
		}
		try {
			const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
			const apiToRequest = `${
				service.eth.network.transaction_api
				}?module=account&action=tokenbalance&contractaddress=${
				this.contractAddress
				}&address=${address}&tag=latest&apikey=${
				service.eth.network.transaction_api_token
				}`;
			const addressBalance = await fetch(`${apiToRequest}`)
				.then(res => res.json())
				.catch(err => {
					logger(
						`Get balance for address ${address} fail`,
						'ethereum.js - Function getBalanceFromEtherscan()',
						err,
					);
				});
			if (addressBalance && addressBalance.status == 1) {
				balance = {
					currency: this.coinCode,
					amount: web3.utils.toBN(addressBalance.result.toString()),
				};
			} else {
				logger(
					`Not found balance of ${address}`,
					'Ethereum.js - Function getBalances()',
				);
			}
		} catch (e) {
			balance = null;
			logger(
				`Error to get balance from Address: ${address}`,
				'Ethereum.js - Function getTransaction()',
				e,
			);
		}
		return balance;
	};
	getTransactionCount = async address => {
		const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
		const apiToRequest = `${
			service.eth.network.transaction_api
			}?module=proxy&action=eth_getTransactionCount&address=${address}&apikey=${
			service.eth.network.transaction_api_token
			}&tag=latest`;
		const result = await fetch(`${apiToRequest}`)
			.then(res => res.json())
			.catch(err => {
				logger(
					`trans count error ${err.message}`,
					'ERC20Coins.js - Function getTransactionCount()',
					'',
				);
				throw new Error(err.message);
			});
		if (result && result.result) {
			if (web3.utils.isHex(result.result)) {
				return web3.utils.hexToNumber(result.result);
			}
			return result.result;
		}
		return null;
	};
	getTransactionReceipt = async txid => {
		const apiToRequest = `${
			service.eth.network.transaction_api
			}?module=proxy&action=eth_getTransactionReceipt&txhash=${txid}&apikey=${
			service.eth.network.transaction_api_token
			}`;
		const result = await fetch(`${apiToRequest}`)
			.then(res => res.json())
			.catch(err => {
				throw new Error(err.message);
			});
		return result;
	};
	/**
	 * provide estimate ETH for current transaction
	 * if current address don't have enough ETH for fee,
	 * we need to call original wallet and send ETH to adapt the transaction
	 */
	getEstimatedEthFee = async transaction => {
		let estimateGas = 0;
		const response = {
			estimateGas: 0,
			estimateETHValue: 0,
		};
		const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
		try {
			const result = await fetch(`${this.api}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					method: 'eth_estimateGas',
					params: [transaction],
					id: '1',
					jsonrpc: '2.0',
				}),
			})
				.then(res => res.json())
				.catch(err => {
					logger(
						`trans count getEstimatedEthFee ${err.message}`,
						'ERC20Coins.js - Function getEstimatedEthFee()',
						'',
					);
					throw new Error(err.message);
				});
			if (result && result.result) {
				estimateGas = web3.utils.hexToNumber(result.result);
				response.status=true;
				response.estimateGas = Math.round(
					parseFloat(
						Big(estimateGas)
							.times(1.2)
							.toString(),
					),
				);
				const gweiValue = Big(estimateGas)
					.times(web3.utils.hexToNumber(transaction.gasPrice))
					.toString();
				response.estimateETHValue = web3.utils.fromWei(gweiValue, 'ether');
			}else{
				logger(
					`Swap coins getEstimatedEthFee because info ${JSON.stringify(result)}`,
					'ERC20Coins.js - Function getEstimatedEthFee()',
					'',
				);
				response.status=false;
			}
			
		} catch (e) {
			logger(
				`Error to get estimate transaction ${JSON.stringify(transaction)}`,
				'ERC20Coins.js - Function getEstimatedEthFee()',
				e,
			);
		}
		return response;
	};
	/**
	 * Get ETH balance of provided address
	 */
	getETHBalance = async address => {
		let balance = null;
		try {
			const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
			const addressBalance = await web3.eth.getBalance(address);
			if (addressBalance) {
				balance = {
					currency: 'ETH',
					amount: web3.utils.fromWei(addressBalance, 'ether'),
				};
			} else {
				logger(
					`Not found balance of ${address}`,
					'ERC20Coins.js - Function getETHBalance()',
				);
			}
		} catch (e) {
			balance = null;
			logger(
				`Error to get balance from Address: ${address}`,
				'Ethereum.js - Function getTransaction()',
				e,
			);
		}
		return balance;
	};

	getEstimatedFeeByTransaction = async (wallet, toData) => {
		const web3 = new Web3(new Web3.providers.HttpProvider(this.api));
		const contract = await new web3.eth.Contract(
			this.abiArray,
			this.contractAddress,
			{ from: wallet.wallet_address },
		);
		const gasPriceToUse = await web3.eth.getGasPrice();
		const transactionCount = await this.getTransactionCount(
			wallet.wallet_address,
		);
		const rawTransaction = {
			from: wallet.wallet_address,
			gasPrice: web3.utils.toHex(gasPriceToUse),
			data: toData.data,
			to: this.contractAddress,
			value: web3.utils.toHex(toData.amount),
			nonce: web3.utils.toHex(transactionCount),
		};
		return await this.getEstimatedEthFee(rawTransaction);
	};

	// stop a connection to coin server
	disconnect = () => true;
}

export default ERC20Coins;
