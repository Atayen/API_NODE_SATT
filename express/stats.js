const { VirtualConsole } = require('jsdom');
const campaign = require('../web3/campaign');

module.exports = function (app) {

const cron =require('node-cron');
const Big = require('big.js');

const allEqual = arr => arr.every( v => v === "0" );

cron.schedule('00 01 * * *',  () => {
	app.account.BalanceUsersStats("daily");
});

cron.schedule("* * 1 * *", () =>{
 app.account.BalanceUsersStats("monthly");
});

cron.schedule("03 04 * * 1", () =>{
 app.account.BalanceUsersStats("weekly");
});

const Grid = require('gridfs-stream');

	const GridFsStorage = require('multer-gridfs-storage');
	const mongoose = require('mongoose');
	const mongoURI = app.config.mongoURI;

	const conn=mongoose.createConnection(mongoURI);
    let gfsLogo;
   	let gfs;
	conn.once('open', () => {
		gfs = Grid(conn.db, mongoose.mongo);
		gfs.collection('campaign_cover');
		gfsLogo = Grid(conn.db, mongoose.mongo);
		gfsLogo.collection('campaign_logo');
	  });

	app.get('/campaign/id/:id', async function(req, response) {


		var idCampaign = req.params.id;
		/*var isCentral = await app.campaign.isCentral(idCampaign);
		if(isCentral) {

			var campaign = await app.statcentral.campaignById(idCampaign);
			response.end(JSON.stringify(campaign));
			return;
		}*/

		var ctr = await app.campaign.getCampaignContract(idCampaign);

	 if(!ctr.methods) {
		 response.end("{}");
		 return;
	 }

		var result = await ctr.methods.campaigns(idCampaign).call();


		var ratios = await ctr.methods.getRatios(idCampaign).call();
		var cmpMetas = await app.db.campaignCrm().find({hash:idCampaign.toLowerCase()}).toArray();


		var types = ratios[0];
		var likes = ratios[1];
		var shares = ratios[2];
		var views = ratios[3];

        // let res = [];
		let cmpRatio = cmpMetas[0].ratios
		// let counter = 0;
        // while(counter < cmpRatio.length){
		// 	let arr = Object.values(cmpRatio[counter]);
		// 	arr.shift()
		// 	if(!allEqual(arr)){
		// 		res.push({typeSN:types[counter],likeRatio:likes[counter],shareRatio:shares[counter],viewRatio:views[counter]})
		// 	}
		// 	counter++;
		// }


		let res = [{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}];
		result.ratios = res;
		result.meta = cmpMetas[0];

		var idproms = await ctr.methods.getProms(idCampaign).call();
		var proms = [];

		var newproms = await app.db.apply().find({idCampaign:idCampaign}).toArray();

		if(idproms.length || newproms.length) {
			var addresses = [];
			var ids = [];
			var idByAddress = [];
			var userById = [];

			for (var i =0;i<idproms.length;i++)
			{
				var prom = await ctr.methods.proms(idproms[i]).call();
				var count = await app.db.ban().find({idProm:idproms[i]}).count();
				prom.id = idproms[i];
				prom.pause = count;
				proms.push(prom);
				if(-1==addresses.indexOf(prom.influencer))
					addresses.push(prom.influencer.slice(2).toLowerCase());
			}
			//

			for (var i =0;i<newproms.length;i++)
			{
				var newprom = newproms[i];
				newprom.id = newprom._id;
				proms.push(newprom);
				if(-1==addresses.indexOf(newprom.influencer))
					addresses.push(newprom.influencer.slice(2).toLowerCase());
			}

			result.proms = proms;

			var wallets = await app.db.wallet().find({"keystore.address": { $in: addresses } }).toArray();
			for (var i =0;i<wallets.length;i++)
			{
				idByAddress["0x"+wallets[i].keystore.address] ="id#"+wallets[i].UserId;
				if(-1==ids.indexOf(wallets[i].UserId))
					ids.push(wallets[i].UserId);
			}
			var users = await app.db.user().find({_id: { $in: ids } }).toArray();
			for (var i =0;i<users.length;i++)
			{
				delete(users[i].accessToken)
				userById["id#"+users[i]._id] = users[i];
			}
			for (var i =0;i<result.proms.length;i++)
			{
				result.proms[i].meta = userById[idByAddress[result.proms[i].influencer.toLowerCase()]];
			}

		}

		var campaignsCrm = await app.db.campaignCrm().find({hash:idCampaign}).toArray();
		if(campaignsCrm.length)
			result.meta = campaignsCrm[0];

		if(result.meta && result.meta.token.name == "SATTBEP20") {
			result.meta.token.name ="SATT";
		}

		response.end(JSON.stringify(result));

	});

	app.get('/v2/campaign/id/:id', async function(req, response) {
		var idCampaign = req.params.id;
		
		var campaign = await app.db.campaigns().findOne({_id:app.ObjectId(idCampaign)});
		if(campaign && campaign.hash){
			var ctr = await app.campaign.getCampaignContract(campaign.hash);
			if(!ctr.methods) {
				response.end("{}");
				return;
			}
			var result = await ctr.methods.campaigns(campaign.hash).call();
			campaign.remaining=result.funds[1];	
		}
		file =await gfs.files.findOne({'campaign.$id':campaign._id});
		if(file){
		const readstream = gfs.createReadStream(file);
		CampaignCover="";
		for await (const chunk of readstream) {
			CampaignCover=chunk.toString('base64');
		}
		campaign.CampaignCover=CampaignCover;
		}else{
			campaign.CampaignCover='';
		}

	let	logo =await gfsLogo.files.findOne({'campaign.$id':campaign._id});
		if(logo){
		const readstream = gfsLogo.createReadStream(logo);
		CampaignLogo="";
		for await (const chunk of readstream) {
			CampaignLogo=chunk.toString('base64');
		}
		campaign.CampaignLogo=CampaignLogo;
		}else{
			campaign.CampaignLogo='';
		}
	
		response.end(JSON.stringify(campaign));
	});

	app.get('/campaign/all/:influencer', async function(req, response) {
		
		var address = req.params.influencer;

		var campaigns = [];
		var rescampaigns = [];
		campaigns = await app.db.campaign().find({contract:{$ne : "central"}}).toArray();

		var campaignsCrm = [];
		var campaignsCrmbyId = [];
		campaignsCrm = await app.db.campaignCrm().find().toArray();

		for (var i = 0;i<campaignsCrm.length;i++)
		{
			if(campaignsCrm[i].hash)
				campaignsCrmbyId[campaignsCrm[i].hash] = campaignsCrm[i];
		}

		for (var i = 0;i<campaigns.length;i++)
		{
			var ctr = await app.campaign.getCampaignContract(campaigns[i].id);
			if(!ctr.methods)
			{
				continue;
			}
			var result = await ctr.methods.campaigns(campaigns[i].id).call();
			campaigns[i].funds =  result.funds;
			campaigns[i].nbProms =  result.nbProms;
			campaigns[i].nbValidProms =  result.nbValidProms;
			campaigns[i].startDate = result.startDate;
			campaigns[i].endDate = result.endDate;

			var ratios = await ctr.methods.getRatios(campaigns[i].id).call();

			var types = ratios[0];
			var likes = ratios[1];
			var shares = ratios[2];
			var views = ratios[3];
			var res = [
				{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},
				{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},
				{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},
				{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}
			    ];
			campaigns[i].ratios = res;

			var idproms = await ctr.methods.getProms(campaigns[i].id).call();
			campaigns[i].proms =[];
			for (var j =0;j<idproms.length;j++)
			{
				var prom = await ctr.methods.proms(idproms[j]).call();
				prom.id = idproms[j];
				if(prom.influencer.toLowerCase() == address.toLowerCase())
					campaigns[i].proms.push(prom);
			}

			if(campaignsCrmbyId[campaigns[i].id])
			{
				campaigns[i].meta = campaignsCrmbyId[campaigns[i].id];
				if(campaigns[i].meta.token.name == "SATTBEP20") {
					campaigns[i].meta.token.name ="SATT";
				}
			}
			
			rescampaigns.push(campaigns[i]);
		}
		//var campaignscentral = await app.statcentral.campaignsByInfluencer(address);

		//rescampaigns = rescampaigns.concat(campaignscentral);

		var unowned = [...rescampaigns].filter((campaign) => address.toLowerCase() !== campaign.owner.toLowerCase())

		response.end(JSON.stringify({allCampaign:unowned}));
		
	})




	app.get('/v2/campaigns/influencer/:influencer', async function(req, response) {
		const token = req.headers["authorization"].split(" ")[1];
		var auth =	await app.crm.auth(token);
		var address = req.params.influencer;
		const limit=parseInt(req.query.limit) || 50;
		const page=parseInt(req.query.page) || 1;
		const skip=limit*(page-1);
		const campaignsPaginator = {}
		const count = await app.db.campaigns().find({$and:[{walletId:{$ne : address},hash: { $exists: true}}]}).count();
		campaignsPaginator.count =count;
		const allCampaigns=[];
		const campaigns = await app.db.campaigns().find({walletId:{$ne : address},hash: { $exists: true}}).sort({createdAt: -1}).skip(skip).limit(limit).toArray();
		for (var i = 0;i<campaigns.length;i++)
		{
			var ctr = await app.campaign.getCampaignContract(campaigns[i].hash);
			if(!ctr.methods)
			{
				continue;
			}
			var result = await ctr.methods.campaigns(campaigns[i].hash).call();
			campaigns[i].funds =  result.funds;
			campaigns[i].nbProms =  result.nbProms;
			campaigns[i].nbValidProms =  result.nbValidProms;
			proms = await app.db.campaign_link().find({$and:[{id_campaign:campaigns[i].hash},{id_wallet:address}]}).toArray();
			campaigns[i].proms =proms;
				file =await gfs.files.findOne({'campaign.$id':campaigns[i]._id});
				if(file){
				const readstream = gfs.createReadStream(file);
				CampaignCover="";
				for await (const chunk of readstream) {
					CampaignCover=chunk.toString('base64');
				}
				campaigns[i].CampaignCover=CampaignCover;
				}else{
					campaigns[i].CampaignCover='';
				}
			allCampaigns.push(campaigns[i]);
		}

		campaignsPaginator.campaigns =allCampaigns;
		response.end(JSON.stringify(campaignsPaginator));
	})

	app.get('/v2/campaigns/:idWallet', async (req, response)=> {
		const token = req.headers["authorization"].split(" ")[1];
		var auth =	await app.crm.auth(token);
		const limit=+req.query.limit || 50;
		const page=parseInt(req.query.page) || 1;
		const skip=limit*(page-1);
		const allCampaigns=[];
        const id_wallet = req.params.idWallet
		let strangerDraft=[]
        strangerDraft= await app.db.campaigns().distinct("_id", { idNode:{ $ne:"0"+auth.id} , hash:{ $exists: false}});
		var idNode="0"+auth.id;

        let query = app.campaign.filterCampaign(req,idNode,strangerDraft);
	
		const campaigns = await app.db.campaigns().find(query).sort({createdAt: -1}).skip(skip).limit(limit).toArray();

		for (var i = 0;i<campaigns.length;i++)
		{
			proms = await app.db.campaign_link().find({id_campaign:campaigns[i].hash,id_wallet}).toArray();
			if(proms.length) campaigns[i].proms =proms;
			allCampaigns.push(campaigns[i]);
		}
		response.end(JSON.stringify(allCampaigns));
	})



	app.get('/v3/campaigns/influencer/:influencer', async function(req, response) {
		const token = req.headers["authorization"].split(" ")[1];
		var auth =	await app.crm.auth(token);
		var address = req.params.influencer;
		const limit=parseInt(req.query.limit) || 50;
		const page=parseInt(req.query.page) || 1;
		const title=req.query.searchTerm || '';
		const status=req.query.status;
		const blockchainType=req.query.blockchainType || '';
		const skip=limit*(page-1);
		const dateJour=new Date() /1000;
		if(req.query.oracles == undefined){
			oracles=["twitter","facebook","youtube","instagram"];
		}
		else if(typeof req.query.oracles === "string"){
			oracles=Array(req.query.oracles);
		}else{
			oracles=req.query.oracles;
		}
		const remainingBudget=req.query.remainingBudget || [];
		const campaignsPaginator = {};
		var query = {};
		query["$and"]=[];
		query["$and"].push({"walletId":{$ne : address}});
		query["$and"].push({"hash":{ $exists: true}});
		query["$and"].push({"ratios.oracle":{ $in: oracles}});
		if(title){
		query["$and"].push({"title":{$regex: ".*" + title + ".*",$options: 'i'}});
		}
		if(blockchainType){
			query["$and"].push({"token.type":blockchainType});
		}
		if(status =="active" ){
			if(remainingBudget.length==2){
				query["$and"].push({"funds.1":{ $gte :  remainingBudget[0], $lte : remainingBudget[1]}});
			}
			query["$and"].push({"$or":[{"endDate":{ $gte : dateJour }},{"funds.1":{$eq: "0"}}]});
		}
		else if(status=="finished"){
			query["$and"].push({"$or":[{"endDate":{ $lt : dateJour }},{"funds.1":{$eq: "0"}}]});
		}
		const count = await app.db.campaigns().find(query).count();
		campaignsPaginator.count =count;
		const allCampaigns=[];
		const campaigns = await app.db.campaigns().find(query).sort({createdAt: -1}).skip(skip).limit(limit).toArray();
		for (var i = 0;i<campaigns.length;i++)
		{
			proms = await app.db.campaign_link().find({$and:[{id_campaign:campaigns[i].hash},{id_wallet:address}]}).toArray();
			campaigns[i].proms =proms;
			allCampaigns.push(campaigns[i]);	
		}	
		campaignsPaginator.campaigns =allCampaigns;
		response.end(JSON.stringify(campaignsPaginator));
	})

	app.get('/campaign/owner/:owner', async function(req, response) {
		var owner = req.params.owner;
		var campaigns = [];
		var rescampaigns = [];
		campaigns = await app.db.campaign().find({contract:{$ne : "central"},owner:owner}).toArray();
		var campaignsCrm = [];
		var campaignsCrmbyId = [];
		campaignsCrm = await app.db.campaignCrm().find().toArray();
		for (var i = 0;i<campaignsCrm.length;i++)
		{
			if(campaignsCrm[i].hash)
				campaignsCrmbyId[campaignsCrm[i].hash] = campaignsCrm[i];
		}
		for (var i = 0;i<campaigns.length;i++)
		{
			var ctr = await app.campaign.getCampaignContract(campaigns[i].id);
			if(!ctr.methods)
			{
				continue;
			}

			if(campaignsCrmbyId[campaigns[i].id])
			{
				campaigns[i].meta = campaignsCrmbyId[campaigns[i].id];
				if(campaigns[i].meta.token.name == "SATTBEP20") {
					campaigns[i].meta.token.name ="SATT";
				}
			}
			var result = await ctr.methods.campaigns(campaigns[i].id).call();
			campaigns[i].funds =  result.funds;
			campaigns[i].nbProms =  result.nbProms;
			campaigns[i].nbValidProms =  result.nbValidProms;
			campaigns[i].startDate = result.startDate;
			campaigns[i].endDate = result.endDate;

			var ratios = await ctr.methods.getRatios(campaigns[i].id).call();
			var types = ratios[0];
			var likes = ratios[1];
			var shares = ratios[2];
			var views = ratios[3];
			var res = [
				{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},
				{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},
				{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},
				{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}];
			campaigns[i].ratios = res;

		var idproms = await ctr.methods.getProms(campaigns[i].id).call();
			campaigns[i].proms =[];
			for (var j =0;j<idproms.length;j++)
			{
				var prom = await ctr.methods.proms(idproms[j]).call();
				prom.id = idproms[j];
			//	if(prom.influencer.toLowerCase() == owner.toLowerCase())
				//	campaigns[i].proms.push(prom);
			}

			rescampaigns.push(campaigns[i]);
		}
		//var campaignscentral = await app.statcentral.campaignsByOwner(owner);
		//rescampaigns = rescampaigns.concat(campaignscentral);


		response.end(JSON.stringify(rescampaigns));
	});

      /*
     @Url :/campaigns/list/:token/addr:?page[number]'
     @description: fetch drafts and created campaign
	 @query: Page number
     @parameters :
     addr : wallet address of user
     token : access token
     @response : object of arrays => draft and created campaigns
     */

	app.get('/campaigns/list/:token/:addr', async function(req, response) {
		try{
			var owner = req.params.addr;
			var campaigns = [];
			var rescampaigns = [];


			campaigns = await app.db.campaign().find({contract:{$ne : "central"},owner:owner}).toArray();
			var campaignsCrm = [];
			var campaignsCrmbyId = [];
			campaignsCrm = await app.db.campaignCrm().find().toArray();
			for (var i = 0;i<campaignsCrm.length;i++)
			{
				if(campaignsCrm[i].hash)
					campaignsCrmbyId[campaignsCrm[i].hash] = campaignsCrm[i];
			}
			for (var i = 0;i<campaigns.length;i++)
			{
				var ctr = await app.campaign.getCampaignContract(campaigns[i].id);
				if(!ctr.methods)
				{
					continue;
				}

				if(campaignsCrmbyId[campaigns[i].id])
				{
					campaigns[i].meta = campaignsCrmbyId[campaigns[i].id];
					if(campaigns[i].meta.token.name == "SATTBEP20") {
						campaigns[i].meta.token.name ="SATT";
					}
				}

				var result = await ctr.methods.campaigns(campaigns[i].id).call();
				campaigns[i].funds =  result.funds;
				campaigns[i].nbProms =  result.nbProms;
				campaigns[i].nbValidProms =  result.nbValidProms;
				campaigns[i].startDate = result.startDate;
				campaigns[i].endDate = result.endDate;

				var ratios = await ctr.methods.getRatios(campaigns[i].id).call();
				var types = ratios[0];
				var likes = ratios[1];
				var shares = ratios[2];
				var views = ratios[3];
				var res = [
					{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},
					{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},
					{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},
					{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}];
				campaigns[i].ratios = res;

				var idproms = await ctr.methods.getProms(campaigns[i].id).call();
				campaigns[i].proms =[];
				for (var j =0;j<idproms.length;j++)
				{
					var prom = await ctr.methods.proms(idproms[j]).call();
					prom.id = idproms[j];
					if(prom.influencer.toLowerCase() == owner.toLowerCase())
						campaigns[i].proms.push(prom);
				}

				rescampaigns.push(campaigns[i]);
			}
			const token = req.headers["authorization"].split(" ")[1];
			var auth =	await app.crm.auth(token);
		//	var campaignscentral = await app.statcentral.campaignsByOwner(owner);
	    //    let created_campaignauthcampaigns.concat(campaignscentral)
			let draft_campaigns = await app.db.campaignCrm().find({idNode:"0"+auth.id,hash:{ $exists: false}}).toArray();
            // draft_campaigns=draft_campaigns.map((c)=>{
			// 	return {...c,stat:'draft'}
			// })

            let campaigns_=[...rescampaigns,...draft_campaigns];
			response.end(JSON.stringify(campaigns_));

		}catch(err){
			response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
		}
	})



	app.get('/campaigns/list/:addr', async function(req, response) {
		try{

			var owner = req.params.addr;
			var campaigns = [];
            let rescampaigns = [];

			campaigns = await app.db.campaign().find({contract:{$ne : "central"},owner:owner}).toArray();
			var campaignsCrm = [];
			var campaignsCrmbyId = [];
			campaignsCrm = await app.db.campaignCrm().find().toArray();
			for (var i = 0;i<campaignsCrm.length;i++)
			{
				if(campaignsCrm[i].hash)
					campaignsCrmbyId[campaignsCrm[i].hash] = campaignsCrm[i];
			}
			for (var i = 0;i<campaigns.length;i++)
			{
				var ctr = await app.campaign.getCampaignContract(campaigns[i].id);
				if(!ctr.methods)
				{
					continue;
				}

				if(campaignsCrmbyId[campaigns[i].id])
				{
					campaigns[i].meta = campaignsCrmbyId[campaigns[i].id];
					if(campaigns[i].meta.token.name == "SATTBEP20") {
						campaigns[i].meta.token.name ="SATT";
					}
				}

				var result = await ctr.methods.campaigns(campaigns[i].id).call();
				campaigns[i].funds =  result.funds;
				campaigns[i].nbProms =  result.nbProms;
				campaigns[i].nbValidProms =  result.nbValidProms;
				campaigns[i].startDate = result.startDate;
				campaigns[i].endDate = result.endDate;

				var ratios = await ctr.methods.getRatios(campaigns[i].id).call();
				var types = ratios[0];
				var likes = ratios[1];
				var shares = ratios[2];
				var views = ratios[3];
				var res = [
					{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},
					{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},
					{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},
					{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}];
				campaigns[i].ratios = res;

				var idproms = await ctr.methods.getProms(campaigns[i].id).call();
				campaigns[i].proms =[];
				for (var j =0;j<idproms.length;j++)
				{
					var prom = await ctr.methods.proms(idproms[j]).call();
					prom.id = idproms[j];
					if(prom.influencer.toLowerCase() == owner.toLowerCase())
						campaigns[i].proms.push(prom);
				}

				rescampaigns.push(campaigns[i]);
			}
			const token = req.headers["authorization"].split(" ")[1];
			var auth =	await app.crm.auth(token);

			let draft_campaigns = await app.db.campaignCrm().find({idNode:"0"+auth.id,hash:{ $exists: false}}).toArray();
            draft_campaigns=draft_campaigns.map((c)=>{
				return {...c,stat:'draft'}
			})

            let Campaigns_=[...rescampaigns,...draft_campaigns]
			response.end(JSON.stringify(Campaigns_));

		}catch(err){
			response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
		}
	})



	app.get('/v2/campaigns/list/:addr', async function(req, response) {
		try{
			const token = req.headers["authorization"].split(" ")[1];
			var auth =	await app.crm.auth(token);
			const limit=parseInt(req.query.limit) || 50;
			const page=parseInt(req.query.page) || 1;
			const skip=limit*(page-1)
			var owner = req.params.addr;
			var campaigns = [];
            let rescampaigns = [];

			campaigns = await app.db.campaign().find({contract:{$ne : "central"},owner:owner}).skip(skip).limit(limit).toArray();
			var campaignsCrm = [];
			var campaignsCrmbyId = [];
			campaignsCrm = await app.db.campaignCrm().find({idNode:"0"+auth.id}).skip(skip).limit(limit).toArray();
			for (var i = 0;i<campaignsCrm.length;i++)
			{
				if(campaignsCrm[i].hash)
					campaignsCrmbyId[campaignsCrm[i].hash] = campaignsCrm[i];
			}
			for (var i = 0;i<campaigns.length;i++)
			{
				var ctr = await app.campaign.getCampaignContract(campaigns[i].id);
				if(!ctr.methods)
				{
					continue;
				}

				if(campaignsCrmbyId[campaigns[i].id])
				{
					campaigns[i].meta = campaignsCrmbyId[campaigns[i].id];
					if(campaigns[i].meta.token.name == "SATTBEP20") {
						campaigns[i].meta.token.name ="SATT";
					}
				}

				var result = await ctr.methods.campaigns(campaigns[i].id).call();
				campaigns[i].funds =  result.funds;
				campaigns[i].nbProms =  result.nbProms;
				campaigns[i].nbValidProms =  result.nbValidProms;
				campaigns[i].startDate = result.startDate;
				campaigns[i].endDate = result.endDate;

				var ratios = await ctr.methods.getRatios(campaigns[i].id).call();
				var types = ratios[0];
				var likes = ratios[1];
				var shares = ratios[2];
				var views = ratios[3];
				var res = [
					{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},
					{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},
					{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},
					{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}];
				campaigns[i].ratios = res;

				var idproms = await ctr.methods.getProms(campaigns[i].id).call();
				campaigns[i].proms =[];
				for (var j =0;j<idproms.length;j++)
				{
					var prom = await ctr.methods.proms(idproms[j]).call();
					prom.id = idproms[j];
					if(prom.influencer.toLowerCase() == owner.toLowerCase())
						campaigns[i].proms.push(prom);
				}
				rescampaigns.push(campaigns[i]);
			}
			
			let count = await app.db.campaignCrm().find({idNode:"0"+auth.id}).count();
			let draft_campaigns = await app.db.campaignCrm().find({idNode:"0"+auth.id,hash:{ $exists: false}}).skip(skip).limit(limit).toArray();
            draft_campaigns=draft_campaigns.map((c)=>{
				return {...c,stat:'draft'}
			})

            let Campaigns_=[...rescampaigns,...draft_campaigns]
		
			const startIndex=(page-1) * limit;
			const endIndex=page * limit;
			const campaignsPaginator = {}
			
			campaignsPaginator.count =count;
					
			campaignWithImage=Campaigns_.slice(startIndex, endIndex);
			for (var i = 0;i<campaignWithImage.length;i++){
				if (campaignWithImage[i].meta){
					idCampaign=campaignWithImage[i].meta._id;
				}else{
					idCampaign=campaignWithImage[i]._id
				}
				
				file =await gfs.files.findOne({'campaign.$id':idCampaign});
				if(file){
					const readstream = gfs.createReadStream(file);
				CampaignCover="";
				for await (const chunk of readstream) {
					CampaignCover=chunk.toString('base64');
				}
				campaignWithImage[i].CampaignCover=CampaignCover;
				}else{
					campaignWithImage[i].CampaignCover='';
				}
			}
			campaignsPaginator.campaigns=campaignWithImage;
			response.end(JSON.stringify(campaignsPaginator));

		}catch(err){
			response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
		}
	}) 


	app.get('/v2/campaigns/owner', async function(req, response) {
		try{
			const token = req.headers["authorization"].split(" ")[1];
			var auth =	await app.crm.auth(token);
			const limit=parseInt(req.query.limit) || 50;
			const page=parseInt(req.query.page) || 1;
			const skip=limit*(page-1);
			const campaignsPaginator = {}
			const allCampaigns=[];
			const count = await app.db.campaigns().find({idNode:"0"+auth.id}).count();
			campaignsPaginator.count =count;
			const campaigns = await app.db.campaigns().find({idNode:"0"+auth.id}).sort({createdAt: -1}).skip(skip).limit(limit).toArray();
			
			for (var i = 0;i<campaigns.length;i++)
			{
			if(campaigns[i].hash){
				var ctr = await app.campaign.getCampaignContract(campaigns[i].hash);
				if(!ctr.methods)
				{
					continue;
				}
				var result = await ctr.methods.campaigns(campaigns[i].hash).call();
				campaigns[i].funds =  result.funds;
				campaigns[i].nbProms =  result.nbProms;
				campaigns[i].nbValidProms =  result.nbValidProms;
			}
				const file =await gfs.files.findOne({'campaign.$id':campaigns[i]._id});
				if(file){
				const readstream = gfs.createReadStream(file);
				CampaignCover="";
				for await (const chunk of readstream) {
					CampaignCover=chunk.toString('base64');
				}
				campaigns[i].CampaignCover=CampaignCover;
				}else{
					campaigns[i].CampaignCover='';
				}
			allCampaigns.push(campaigns[i]);
			}
			campaignsPaginator.campaigns =allCampaigns;
			response.end(JSON.stringify(campaignsPaginator));

		}catch(err){
			response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
		}
	}) 


	app.get('/proms/owner/:owner', async function(req, response) {
		var owner = req.params.owner;
		var proms = [];
		proms = await app.db.event().find({type : "applied",owner:owner}).toArray();
		//var promscentral = await app.statcentral.promsByOwner(owner);
		//proms = proms.concat(promscentral);
		response.end(JSON.stringify(proms));
	});

	app.get('/campaign/draft/:token', async function(req, response) {
		var res = await app.crm.auth( req.params.token);
		var campaigns = await app.db.campaignCrm().find({idNode:"0"+res.id,hash:{ $exists: false}}).toArray();
		response.end(JSON.stringify(campaigns));
	})

	app.get('/v2/campaign/draft/:token', async function(req, response) {
		var res = await app.crm.auth( req.params.token);
		var campaigns = await app.db.campaigns().find({idNode:"0"+res.id,hash:{ $exists: false}}).toArray();
		response.end(JSON.stringify(campaigns));
	})

/*
	@url : campaign/OneDraft/:id
	@description: get One draft for user
	@params:
    id : draft id
	{headers}
	@Output JSON object
	*/
	app.get('/campaign/OneDraft/:id', async (req,response)=>{
		try {
			const token = req.headers["authorization"].split(" ")[1];
			var res =	await app.crm.auth(token);
			const idNode="0"+res.id;
		const campaign = await app.db.campaignCrm().findOne({_id: app.ObjectId(req.params.id),idNode,hash:{ $exists: false}});
		response.end(JSON.stringify(campaign));
	} catch (err) {
		response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
	}
	})

	app.get('/campaign/:id/proms', async function(req, response) {

		var idCampaign = req.params.id;

		/*if(app.campaign.isCentral(idCampaign)) {
			var proms = await app.statcentral.promsByCampaign(idCampaign);
			response.end(JSON.stringify(proms));
			return;
		}*/

		var ctr = await app.campaign.getCampaignContract(idCampaign);
		ctr.methods.getProms(idCampaign).call().then(function (results) {
			response.end(JSON.stringify(results));
		});
	})

	app.get('/campaign/:id/ratios', async function(req, response) {

		var idCampaign = req.params.id;


		var ctr = await app.campaign.getCampaignContract(idCampaign);

		ctr.methods.getRatios(idCampaign).call().then(function (results) {
			var types = results[0];
			var likes = results[1];
			var shares = results[2];
			var views = results[3];
		   var res = [
				{typeSN:types[0],likeRatio:likes[0],shareRatio:shares[0],viewRatio:views[0]},
				{typeSN:types[1],likeRatio:likes[1],shareRatio:shares[1],viewRatio:views[1]},
				{typeSN:types[2],likeRatio:likes[2],shareRatio:shares[2],viewRatio:views[2]},
				{typeSN:types[3],likeRatio:likes[3],shareRatio:shares[3],viewRatio:views[3]}];
			response.end(JSON.stringify(res));
		});
	})



	app.get('/campaign/:id/funds', async function(req, response) {
		var idCampaign = req.params.id;
		var ctr = await app.campaign.getCampaignContract(idCampaign);

		ctr.methods.campaigns(idCampaign).call().then(function (results) {
			response.end(JSON.stringify(results.funds));
		});
	})

	app.get('/campaign/:id/status',async  function(req, response) {

		var idCampaign = req.params.id;
		var ctr = await app.campaign.getCampaignContract(idCampaign);

		ctr.methods.campaigns(idCampaign).call().then(function (results) {
			response.end(JSON.stringify(results));
		});
	})

	app.get('/campaign/:id/events', function(req, response) {
		var idCampaign = req.params.id;
		app.db.event().find({id:idCampaign}).toArray(function(err,evts){
			response.end(JSON.stringify(evts));
		})
	})

	app.get('/prom/:id/status',async function(req, response) {
		var idProm = req.params.id;
		var ctr = await app.campaign.getPromContract(idProm);

		ctr.methods.proms(idProm).call().then(function (results) {
			delete(results.results)
			response.end(JSON.stringify(results));
		});
	})

	app.get('/prom/:id/results',async  function(req, response) {
		var idProm = req.params.id;


		/*if(idProm.substring(0,2) != "0x")
		{
			var prom = await app.db.apply().findOne({_id:app.ObjectId(idProm)})
			var res = await app.statcentral.resultsByProm(idProm);
			response.end(JSON.stringify(res));
			return;
		}*/

		var ctr = await app.campaign.getPromContract(idProm);


		var res2 = [];
		var results = await ctr.methods.getResults(idProm).call();
			for(var i = 0;i<results.length;i++) {
				var r = await ctr.methods.results(results[i]).call();
				res2.push(r);
			}
			response.end(JSON.stringify(res2));
	})

	app.get('/prom/:id/live', async function(req, response) {
		var idProm = req.params.id;


	/*if(idProm.substring(0,2) != "0x")
		{
			var prom = await app.db.apply().findOne({_id:app.ObjectId(idProm)})
			var res = await app.statcentral.resultsByPromLive(idProm);
			response.end(JSON.stringify(res));
			return;
		}*/

		var ctr = await app.campaign.getPromContract(idProm);

		ctr.methods.proms(idProm).call().then( async function (results) {
			results.typeSN = results.typeSN.toString();
			switch(results.typeSN) {
				case "1" :
					var res = await app.oracle.facebook(results.idUser,results.idPost);

				break;
				case "2" :
					var res = await app.oracle.youtube(results.idPost);

				break;
				case "3" :
					var res = await app.oracle.instagram(results.idPost)

				break;
				case "4" :
					var res = await app.oracle.twitter(results.idUser,results.idPost)

				break;
				default :
					var res = {likes:0,shares:0,views:0,date:Date.now()};
				break;
			}

			response.end(JSON.stringify(res));
			/*app.db.cache().find({"typeSN":results.typeSN,"idPost":results.idPost,"idUser":results.idUser}).toArray(function(err,res2){
				response.end(JSON.stringify(res2[0]));
			})*/
		});

	})

	app.get('/results/:id', function(req, response) {
		var idRequest = req.params.id;
		app.campaign.contract.methods.results(idRequest).call().then(function (results) {
			response.end(JSON.stringify(results));
		});
	})

	app.get('/isalreadysed/:type/:idpost/:iduser', async function(req, response) {
		var type = req.params.type;
		var idPost = req.params.idpost;
		var idUser = req.params.iduser;
	//	var res = await app.statcentral.isUsed(type,idPost,idUser)
		app.campaign.contract.methods.getIsUsed(type,idPost,idUser).call().then(function (results) {
			console.log("already",type,idpost,results);
			response.end( results);
		});
	})
	app.get('/isalreadysed/:type/:idpost', async function(req, response) {
		var type = req.params.type;
		var idPost = req.params.idpost;
		//var res = await app.statcentral.isUsed(type,idPost)
		app.campaign.contract.methods.getIsUsed(type,idPost,'').call().then(function (results) {
			console.log("already",type,idpost,results);
			response.end( results);
		});

	})


	  /*
     @Url :API (link) /balance/stats'
     @description: fetch user chart stats
	 @parameters : header access token
     @response : object of arrays => different balance stats (daily, weekly, monthly)
     */
	app.get("/balance/stats", async (req, response) => {
		try {
			const token = req.headers["authorization"].split(" ")[1];
			var res =	await app.crm.auth(token);
			const id = res.id;
			let result={};
			let user = await app.db.sn_user().findOne({_id : id});
			if(user.daily && user.daily.length > 0){result.daily = user.daily}
			if(user.weekly && user.weekly.length >0){result.weekly = user.weekly;}
			if(user.monthly && user.monthly.length >0){result.monthly = user.monthly;}
            response.end(JSON.stringify(result));
		}catch(err){
			response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
		}
	})


	app.get('/script/balance/:condition', async (req, response) => {
        try{
			// const token = req.headers["authorization"].split(" ")[1];
			// var res =	await app.crm.auth(token);
		// if([app.config.idNodeAdmin1, app.config.idNodeAdmin2].includes(res.id)){
			let condition = req.params.condition
		    await  app.account.BalanceUsersStats(condition);
			response.send(JSON.stringify({message : 'runned'}))
		// }
		} catch (err) {
			response.end('{"error":"'+(err.message?err.message:err.error)+'"}');
		 }
	   })


	 app.get('/campaign/statistics/:idCampaign', async (req, res)=>{
		try{
	    const idCampaign = req.params.idCampaign
		const result = await app.campaign.campaignStats(idCampaign)
     res.end(JSON.stringify(result))
		}catch (err) {
		 res.end('{"error":"'+(err.message?err.message:err.error)+'"}');
	  }
	})

   app.get('/prom/stats/:idProm', async (req, res) => {
	try{

	   let totalToEarn;
	   const idProm = req.params.idProm;
	   const info =  await app.db.campaign_link().findOne({ id_prom : idProm });
	   const payedAmount = info.payedAmount || "0";
	   const campaign = await app.db.campaigns().findOne({hash : info.id_campaign});
       const ratio = campaign.ratios
	   const bounties =campaign.bounties
       if(ratio.length){
	   ratio.forEach(elem =>{
		   if(elem.oracle === info.oracle){
           let view =new Big(elem["view"]).times(info.views || "0")
		   let like =  new Big(elem["like"]).times(info.likes)
		   let share = new Big(elem["share"]).times(info.shares)
		   totalToEarn = view.plus(like).plus(share).toFixed()
		   }
	   })
	   info.totalToEarn = new Big(totalToEarn).minus(new Big(payedAmount))
	}
	  if(bounties.length){
		bounties.forEach( bounty=>{
			if(bounty.oracle === info.oracle){
			  bounty.categories.forEach( category=>{
			   if( (+category.minFollowers <= +info.abosNumber)  && (+info.abosNumber <= +category.maxFollowers) ){
				  info.totalToEarn = category.reward;					
			    }else if(+info.abosNumber > +category.maxFollowers){
				info.totalToEarn = category.reward;	
			 }



			  })	
			   }			   
			   })
	  }
	   res.end(JSON.stringify({prom : info}))
	}catch (err) {
		res.end('{"error":"'+(err.message?err.message:err.error)+'"}');
	 }
   })
   	/*
     @link : /campaign/:idCampaign/proms/all
     @description: fetching all campaign proms with it's stats & update status
     @params:
	 @Input idCampaign:campaign hash
	 @Output array of objects(proms)
     */
     app.get('/campaign/:idCampaign/proms/all', async (req, res) => {
		try{	

	const campaign = await app.db.campaigns().findOne({_id : app.ObjectId(req.params.idCampaign)});
			let ctr = await app.campaign.getCampaignContract(campaign.hash)
	 if(!ctr) {
			 res.end("{}");
		 return;
	 }else{   
	  const funds = campaign.funds ? campaign.funds[1] : campaign.cost;	 
	  const allProms =  await app.campaign.campaignProms(campaign.hash,ctr);	 
	  const ratio = campaign.ratios;
	  const bounties = campaign.bounties;
	  let view;
	  let share;
	  let like;
	  const dbProms =await app.db.campaign_link().find({ id_campaign : campaign.hash }).toArray();
			dbProms.forEach(result=>{
 
		 for(let i = 0; i < allProms.length; i++){
		          
			  if(allProms[i].id === result.id_prom){
				if(result.status === "rejected"){
			   allProms[i].isAccepted = "rejected";
			   continue;
		   }
		    
		   allProms[i].appliedDate = result.appliedDate
		   allProms[i].numberOfLikes = result.likes || "0"
		   allProms[i].numberOfViews = result.views || '0'
		   allProms[i].numberOfShares = !result.shares ? '0' : result.shares +"";
		   allProms[i].unPayed = result.fund
		   allProms[i].payedAmount = result.payedAmount || "0";
           allProms[i].oracle = result.oracle;
		   allProms[i].media_url=result.media_url;
		   
	
		   let promDone = funds == "0" && result.fund =="0" ? true : false;
		   if(ratio.length && allProms[i].isAccepted && !promDone){
                              
				ratio.forEach( num =>{
					
							if(num.oracle === result.oracle){
								if(result.views){
									view =new Big(num["view"]).times(result.views)
								
								}
								if(result.likes){
								like =  new Big(num["like"]).times(result.likes) || "0";
									
								}
								
							
								share = new Big(num["share"]).times(result.shares) || "0";
									
								
								if(view && share && like){	 
								allProms[i].totalToEarn = view.plus(like).plus(share).toFixed();
								}
							
							}
						})		
		   }

		   if(bounties.length && allProms[i].isAccepted && !promDone){
			  
			  allProms[i].abosNumber =  result.abosNumber
		       bounties.forEach( bounty=>{
              if(bounty.oracle === allProms[i].oracle){
				bounty.categories.forEach( category=>{
			
				 if( (+category.minFollowers <= +allProms[i].abosNumber)  && (+allProms[i].abosNumber <= +category.maxFollowers) ){
					allProms[i].reward = category.reward;					
				 }else if(+allProms[i].abosNumber > +category.maxFollowers){
				 allProms[i].reward = category.reward;
				 }
				})	
			     }			   
		         })
		 }
		
	    }
	}		
	  })
		
	
 
	 res.send(JSON.stringify({allProms}))
 } 
 }catch (err) {
	 console.log(err)
	 res.end('{"error":"'+(err.message?err.message:err.error)+'"}');
  }
	})


	app.get('/proms/verify/:idProm', async (req, res) => {
		try{
		const token = req.headers["authorization"].split(" ")[1];
		var auth =	await app.crm.auth(token);
		let idProm = req.params.idProm;
	    var ctr = await app.campaign.getPromContract(idProm);
		if(!ctr.methods) {
			res.end("{}");
			return;
		}
	    let prom = await ctr.methods.proms(idProm).call();

        let prevStats =  await ctr.methods.results(prom.prevResult).call();

		var stats;
		if(prom.typeSN == 1){
	    const idPost = prom.idPost.split(':')
		 stats = await app.oracle.facebook(prom.idUser,idPost[0]);
		} else if(prom.typeSN == 2){
		 stats = await app.oracle.youtube(prom.idPost);
		} else if(prom.typeSN == 3){

		 stats = await app.oracle.instagram(auth.id,prom.idPost);
		} else{
		 stats = await app.oracle.twitter(prom.idUser,prom.idPost);
		}
		
		
		let likes = stats.likes ? stats.likes.toString() : '0';
		let views  = stats.views ? stats.views.toString() :'0' ;
		let shares =  stats.shares ? stats.shares.toString() : '0';

		let actualStats = [likes,views,shares];
		let arrPrevStat = [prevStats.likes,prevStats.views,prevStats.shares];

		if(!actualStats.reduce((a, b) => a && arrPrevStat.includes(b), true)){ // if previous stats are different from the ones from the oracle
         res.send(JSON.stringify({disabled : false, fund:prom.funds.amount }))
		}else if(actualStats.reduce((a, b) => a && arrPrevStat.includes(b), true) && prom.funds.amount !== "0"){ //if we have same stats we need to check prom.fund.amount
			res.send(JSON.stringify({disabled : false, fund:prom.funds.amount }))
		}	else{
			
			res.send(JSON.stringify({disabled : true, fund : prom.funds.amount})) //disable getGains method button
		}
		}catch (err) {
	 console.log(err)
	 res.end('{"error":"'+(err.message?err.message:err.error)+'"}');
  }
	})

return app;
}
