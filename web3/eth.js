module.exports = async function (app) {
	delete(global._bitcore);
	
	var EthHdkey = require('ethereumjs-wallet/hdkey');
	var HDKey = require('hdkey');
	var bitcore = require('bitcore-lib');
	
	var fs = require("fs");
	var rp = require('request-promise');
	var cron = require('node-cron');
	var child = require('child_process');
	
	var bip32 = require("bip32")
	var bip39 = require('bip39');
	var bitcoinjs = require('bitcoinjs-lib');
	var coinselect = require('coinselect');
	const ethUtil = require('ethereumjs-util');
	
	var sattKeystore = fs.readFileSync(app.config.SattReservePath,'utf8');
	app.sattWallet = JSON.parse(sattKeystore);

	var BN = require("bn.js");
	
	
	var PrivateKey = bitcore.PrivateKey;
	var seed = await bip39.mnemonicToSeed(app.config.masterSeed);
	var masterSeedEth = EthHdkey.fromMasterSeed(seed.toString('hex'));
	var masterEth = masterSeedEth.derivePath(app.config.derivePathEth);
	var masterSeedBtc = HDKey.fromMasterSeed(seed.toString('hex'));
	var masterBtc = masterSeedBtc.derive(app.config.derivePathBtc);
	var cryptoManager = {};
	
	cryptoManager.transfer = async function (to,amount,credentials) {
		return new Promise( async (resolve, reject) => {
		
			if(!app.web3.utils.isAddress(to))
				reject({error:"Invalid address"});
			
			var gasPrice = await app.web3.eth.getGasPrice();
			var gas = 21000;
				
			var receipt = await app.web3.eth.sendTransaction({from: credentials.address,value:amount, gas: gas,to:to,gasPrice: gasPrice})
			.once('transactionHash', function(hash){
				console.log("transactionHash",hash)
			})
			
			app.io.confirm(receipt.transactionHash,0);
			var tx = await app.web3.eth.getTransaction(receipt.transactionHash);
			tx.txtype = "ETHER";
			tx.apiversion = 2;
			tx.date = Date.now();
			tx.networkid = app.config.blockChain;
			tx.from = tx.from.toLowerCase();
			tx.to = tx.to.toLowerCase();
			tx.from_id = credentials.from_id;
			tx.to_id = credentials.to_id;
			app.db.txs().insertOne(tx);
			resolve({result : "OK",hash:receipt.transactionHash})
					
		})
		
	};
	
	cryptoManager.sendBtc = async function (id,pass,to,amount) {
		
		
		var account = await app.db.wallet().findOne({UserId: parseInt(id)});
		
		var escpass = pass.replace(/'/g, "\\'");
		
		var priv = child.execSync(app.config.bxCommand+' ek-to-ec \''+escpass+'\' '+account.btc.ek,app.config.proc_opts).toString().replace("\n","");
		var wif = child.execSync(app.config.bxCommand+' ec-to-wif '+priv,app.config.proc_opts).toString().replace("\n","");
		
		var addr = account.btc.addressSegWitCompat;
		
		var utxo = JSON.parse(child.execSync(app.config.btcCmd+" listunspent 1 1000000 '[\""+addr+"\"]'"));
		
		//var utxo = await rp({uri:app.config.btcElectrumUrl+"utxo/"+addr,json: true});
		
		if(!utxo.length)
		{
			return {error:"insufficient funds "};
		}
		
		
		var max = 0.0;
		for(var i = 0;i<utxo.length;i++) {
			max += parseFloat( utxo[i].amount);
		}
		max = Math.floor(parseFloat(max)*100000000);
		
		
		
		var body = await rp({uri:app.config.BtcFees,json: true});
		var feeRate = 150; // parseInt(body.fastestFee);
		
		var maxFee = 20000;
		
		const keyPair = bitcoinjs.ECPair.fromWIF(wif);
		const txb = new bitcoinjs.TransactionBuilder();
		
		
		var input_sum = 0;
		var fee = (45 + utxo.length*93)*feeRate;
		for(var i = 0;i<utxo.length;i++) {
			txb.addInput(utxo[i].txid,parseInt(utxo[i].vout));
			input_sum += Math.round(parseFloat(utxo[i].amount)*100000000);
		}
		var change = input_sum - parseInt(amount) - (fee+34*feeRate) ;
		txb.addOutput(to, parseInt(amount));
		
		if(change > fee)
		{
			txb.addOutput(addr, parseInt(change));
			fee += 34*feeRate; 
		}
		
		
		if(parseInt(amount) +  parseInt(fee) > max)
		{
			return {error:"insufficient funds, fee requirement : "+fee+" satoshis"};
		}
		
		const p2wpkh = bitcoinjs.payments.p2wpkh({ pubkey: keyPair.publicKey });
		const p2sh = bitcoinjs.payments.p2sh({ redeem: p2wpkh });

		for(var i = 0;i<utxo.length;i++) {
			
			txb.sign(i, keyPair,p2sh.redeem.output, null, Math.round(parseFloat(utxo[i].amount)*100000000));
		}
		var tx = txb.build()

		var signed = tx.toHex();
		var hash = tx.getId();
		
		console.log("btc signed tx ",signed);
		
		
		var rec = child.execSync(app.config.btcCmd+' sendrawtransaction "'+signed+'"');
		//var rec = await rp({uri:app.config.btcElectrumUrl+"tx/",method: 'POST',body:{tx:signed},json: true});
		return hash;
	}
	
	cryptoManager.getReceiveEthWallet = async function (userId) {
		return new Promise( async (resolve, reject) => {
			var account = await app.db.wallet().findOne({UserId: parseInt(userId)})
			
			if(!account)
				reject(false);
			else
			{
				var myWallet = masterEth.deriveChild(account.num).getWallet();
				var addrHd = "0x"+myWallet.getAddress().toString('hex');
				await app.db.wallet().updateOne({UserId: parseInt(userId)}, {$set: {EthHD: addrHd}})
				resolve(addrHd);
			}
		});
	};
	
	cryptoManager.getReceiveBtcWallet = async function (userId) {
		return new Promise( async (resolve, reject) => {
			var account = await app.db.wallet().findOne({UserId: parseInt(userId)})
			
			if(!account)
				reject(false);
			else
			{
				var myWallet = masterBtc.deriveChild(account.num);
				var addr = new PrivateKey(myWallet.privateKey.toString("hex"));
				
				const keyPair = bitcoinjs.ECPair.fromWIF(addr.toWIF());
				const address1 = bitcoinjs.payments.p2pkh({ pubkey: keyPair.publicKey }).address;
				const addressbc1 = bitcoinjs.payments.p2wpkh({ pubkey: keyPair.publicKey }).address
				const address3 = bitcoinjs.payments.p2sh({
					  redeem: bitcoinjs.payments.p2wpkh({ pubkey: keyPair.publicKey })
					}).address
				var pub = myWallet.publicKey.toString("hex");
				//child.execSync(app.config.btcCmd+" importpubkey "+pub+" 'default' false");
				await rp({uri:app.config.btcElectrumUrl+"pubkey/",method: 'POST',body:{pubkey:pub},json: true});
				
				await app.db.wallet().updateOne({UserId: parseInt(userId)}, {$set: {BtcHDPublicKey:pub,BtcHD: address1,BtcHDSegWitCompat:address3,BtcHDSegWit:addressbc1}});
				resolve(address3);
			}
		});
	};
	
	cryptoManager.listEthPayers = async function () {
		return new Promise( async (resolve, reject) => {
			var results = await app.db.wallet().find({EthHD: { $exists: true}}).toArray();
			var res = [];
			for(var i = 0;i<results.length;i++)
			{
				var bal = await app.web3.eth.getBalance(results[i].EthHD);
				if(bal>0)
				{
					
					
					res.push({id:results[i].UserId,EthHD:results[i].EthHD,balance:bal/1000000000000000000});
				}
			}
			resolve(res);
		})
	}
	
	cryptoManager.listBtcPayers = async function () {
		return new Promise( async (resolve, reject) => {
			var results = await app.db.wallet().find({BtcHDSegWitCompat: { $exists: true}}).toArray();
			var tempres = [];
			var listbtc = [];
			
			var utxos = JSON.parse(child.execSync(app.config.btcCmd+' listunspent 0 1000000'));
			
			//var utxos = await rp({uri:app.config.btcElectrumUrl+"utxos/",json: true});
			
			
			if(!utxos.length)
			{
				resolve(listbtc);
				return;
			}
			
			var amounts = utxos.reduce(function(res,cur) {
		        res[cur.address] = res[cur.address] || 0.0;
				res[cur.address] += parseFloat(cur.amount);
				return res;
			});
			if(isNaN(amounts[amounts.address]))
				amounts[amounts.address] = parseFloat(amounts.amount);
			else
				amounts[amounts.address] = parseFloat(amounts.amount);
			
			for(var i = 0;i<results.length;i++)
			{
				
				if(amounts[results[i].BtcHDSegWitCompat] && amounts[results[i].BtcHDSegWitCompat] > 0.00000547)
				{
					listbtc.push({id:results[i].UserId,BtcHDSegWitCompat:results[i].BtcHDSegWitCompat,balance:amounts[results[i].BtcHDSegWitCompat]});
				}
				//touched
			}
			resolve(listbtc);
		})
	}
	
	cryptoManager.receiveEthWallet = async function (userId) {
		return new Promise( async (resolve, reject) => {
			var account = await app.db.wallet().findOne({UserId: parseInt(userId)})
			
			var myWallet = masterEth.deriveChild(account.num).getWallet();
			var fromAddr = "0x"+myWallet.getAddress().toString('hex');
			var gasPrice = await app.web3.eth.getGasPrice();
			
			var bal = await app.web3Inf.eth.getBalance(fromAddr);
			

			var bnbal = new BN(""+bal);
			var bngas = new BN(21000);
			var bnmore = new BN(10000000000);
			var bngasPrice = new BN(""+gasPrice);
			bngasPrice = bngasPrice.add(bnmore);
			
			
			
					
			if(bnbal.lt(bngas.mul(bngasPrice)))
			{
				reject({error:"amount too low"});
				
			}
			else
			{
				var tx = {
					from:fromAddr,
					to:app.config.ledgerAddress,
					value: bnbal.sub(bngas.mul(bngasPrice)),
					gas:21000,
					gasPrice:bngasPrice
				};
				
						
				var signed = await app.web3Inf.eth.accounts.signTransaction(tx, "0x"+myWallet.getPrivateKey().toString('hex'));
				var receipt = await app.web3Inf.eth.sendSignedTransaction(signed.rawTransaction)
				.once('transactionHash', async function(hash){
					console.log("transactionHash",hash)
					
				});
				
				
				var p = await app.db.rate().findOne({symbol:"ETH",date:{ $gt: Date.now()-600000 } });
				
				var bnamount = bnbal.mul(new BN(Math.floor(parseFloat(p.price)/0.0042*app.config.icoFactor)));
				
				var to = "0x"+account.keystore.address;
				
				var cred = {
					address: app.config.SattReserve,
					to_id:userId
				};
				
				/////////////
				//await cryptoManager.unlockReserve();
				//console.log("recover eth ",to,bnamount.toString(),cred);					
				//await app.token.transfer(to,bnamount.toString(),cred);	
				/////////////
				var res = await app.db.sattbuy().insertOne({UserId:userId,to:to,amount:bnamount.toString(),type:"ETH",isNew:true});
				console.log("eth satt buy filed",userId,to,bnamount.toString());
				//////////////
				resolve({result : "OK",hash:res.insertedId,amount:(tx.value/app.config.EtherWei)})
			}
				
				
		});
	};
	
	cryptoManager.receiveBtcWallet = async function (userId) {
		return new Promise( async (resolve, reject) => {
			var account = await app.db.wallet().findOne({UserId: parseInt(userId)})
			var myWallet = masterBtc.deriveChild(account.num);
			
			var addr = new PrivateKey(myWallet.privateKey.toString("hex"));
		    
			
			const keyPair = bitcoinjs.ECPair.fromWIF(addr.toWIF());
			
			const address1 = bitcoinjs.payments.p2pkh({ pubkey: keyPair.publicKey }).address;
			const addressbc1 = bitcoinjs.payments.p2wpkh({ pubkey: keyPair.publicKey }).address
			const address3 = bitcoinjs.payments.p2sh({
				  redeem: bitcoinjs.payments.p2wpkh({ pubkey: keyPair.publicKey })
				}).address
				
			//var body = await rp({uri:app.config.BtcFees,json: true});
			//var feeRate = parseInt(body.fastestFee);
			var feeRate = 150; 
			
			
			// btc full node
			//var utxo = JSON.parse(child.execSync(app.config.btcCmd+" listunspent 1 1000000 '[\""+address3+"\"]'"));
			//var amount = Math.round(parseFloat(utxo[0].amount)*100000000);
			// btc full node
			
			// btc electrum
			var utxo = await rp({uri:app.config.btcElectrumUrl+"utxo/"+address3,json: true});
			if(!utxo.length)
			{
				reject({error:"null account balance"});
				return;
			}
			
			var amount = Math.round(parseFloat(utxo[0].amount)*100000000);
			//var amount = parseFloat(utxo[0].value);
			// btc electrum
			
			
			var amountfee = amount - (feeRate*138) ;
			if(amountfee <= 0 )
			{
				reject({error:"null account balance"});
			}
			else
			{

				
				const txb = new bitcoinjs.TransactionBuilder();
				
				
				// btc full node
				txb.addInput(utxo[0].txid,parseInt(utxo[0].vout));
				// btc full node
				
				// btc electrum
				//txb.addInput(utxo[0].tx_hash,parseInt(utxo[0].tx_pos));
				// btc electrum
				
				const p2wpkh = bitcoinjs.payments.p2wpkh({ pubkey: keyPair.publicKey });
				const p2sh = bitcoinjs.payments.p2sh({ redeem: p2wpkh });
				
				txb.addOutput(app.config.AddrBtcExchange, amountfee)
				
				
				txb.sign(0, keyPair,p2sh.redeem.output,null,amount);
				
				
				
				var tx = txb.build()

				var signed = tx.toHex();
				var hash = tx.getId();
				
				// btc full node
				//var rec = child.execSync(app.config.btcCmd+' sendrawtransaction "'+signed+'"');
				// btc full node
				
				// btc electrum
				var rec = await rp({uri:app.config.btcElectrumUrl+"tx/",method: 'POST',body:{tx:signed},json: true});
				// btc electrum
				
				
				console.log(" tx broadcast",rec);
				
				var gasPrice = await app.web3.eth.getGasPrice();
				var p = await app.db.rate().findOne({symbol:"BTC",date:{ $gt: Date.now()-800000 } });			
				
				
				var bn10 = new BN("10000000000");
				var bn = new BN(Math.floor( amount*parseFloat(p.price)/0.42*app.config.icoFactor*100));
				
				var cred = {
					address: app.config.SattReserve,
					to_id:userId
				};
				var to = "0x"+account.keystore.address;			
				
				console.log("btc payback",signed);
				
				
				///////
				//await cryptoManager.unlockReserve();
				//var ethres = await app.token.transfer(to,bn10.mul(bn).toString(),cred);
				//////////
				var finalamount = bn10.mul(bn).toString();
				var res = await app.db.sattbuy().insertOne({UserId:userId,to:to,amount:finalamount,type:"BTC",isNew:true});
				console.log("btc satt buy filed",userId,to,finalamount);
				////////
				
				
				resolve({btcTxHash:res.insertedId,amount:amount/100000000});
			}
			
	
			
		});
		
	};
	
	cryptoManager.unlockReserve = async function () {
		return new Promise( async (resolve, reject) => {
			app.web3.eth.accounts.wallet.decrypt([app.sattWallet], app.config.SattReservePass);
			resolve();
		});
	}
	
	app.btcPrice = {price:false,timestamp:Date.now()};
	app.ethPrice = {price:false,timestamp:Date.now()};
	
	cryptoManager.getRateBtc = async function () {
		return new Promise(async (resolve, reject) => {
			if(app.btcPrice.price && (Date.now() - app.btcPrice.timestamp) < 600000 )
			{
				resolve(app.btcPrice.price);
			}
			else {
				const requestOptions = {
					  method: 'GET',
					  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
					  qs: {
						start: 1,
						limit: 10,
						convert: 'USD'
					  },
					  headers: {
						'X-CMC_PRO_API_KEY': app.config.cmcApiKey
					  },
					  json: true,
					  gzip: true
					};
					
					var body = await rp(requestOptions);
					var prices = body.data;
				
				
				for (var i=0;i<prices.length;i++)
				{
					if(prices[i].symbol == 'BTC')
					{
						app.btcPrice = {price:prices[i].quote['USD'].price,timestamp:Date.now()};
						resolve(prices[i].quote['USD'].price);
					}
				}
			}
			
		})
		
	};
	
	
	cryptoManager.getRateEth = async function () {
		return new Promise(async (resolve, reject) => {
			if(app.ethPrice.price && (Date.now() - app.ethPrice.timestamp) < 600000 )
			{
				resolve(app.ethPrice.price);
			}
			else {
				const requestOptions = {
					  method: 'GET',
					  uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest',
					  qs: {
						start: 1,
						limit: 10,
						convert: 'USD'
					  },
					  headers: {
						'X-CMC_PRO_API_KEY': app.config.cmcApiKey
					  },
					  json: true,
					  gzip: true
					};
					
					var body = await rp(requestOptions);
					var prices = body.data;
				
				for (var i=0;i<prices.length;i++)
				{
					if(prices[i].symbol == 'ETH')
					{
						app.ethPrice = {price:prices[i].quote['USD'].price,timestamp:Date.now()};
						resolve(prices[i].quote['USD'].price);
					}
				}
			}
			
		})
		
	};
	
	cron.schedule('*/10 * * * *',async function(){
		var rate = await cryptoManager.getRateEth();
		app.db.rate().insertOne({price:rate,symbol:"ETH",date:Date.now()});
		var rate = await cryptoManager.getRateBtc();
		app.db.rate().insertOne({price:rate,symbol:"BTC",date:Date.now()});
	});
	
	app.cryptoManager = cryptoManager;
	return app;
}