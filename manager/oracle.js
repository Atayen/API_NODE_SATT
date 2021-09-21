module.exports = async function (app) {

	var request = require('request');
	var rp = require('request-promise');
	var fs = require("fs");
	var Twitter = require('twitter');

	var Twitter2 = require('twitter-v2');
	var jsdomlib = require("jsdom");
	var jsdom = jsdomlib.JSDOM;

	var tweet = new Twitter({
	  consumer_key: app.config.twitter.consumer_key_alt,
	  consumer_secret: app.config.twitter.consumer_secret_alt,
	  access_token_key: app.config.twitter.access_token_key,
	  access_token_secret: app.config.twitter.access_token_secret
	});

	var oracleManager = {};

	var campaignKeystore = fs.readFileSync(app.config.campaignWalletPath,'utf8');
	app.campaignWallet = JSON.parse(campaignKeystore);



	oracleManager.facebookAbos = async function (pageName,idPost) {
		return new Promise(async (resolve, reject) => {

				var page = await app.db.fbPage().findOne({username: pageName});

				if(page) {
					var token = page.token;
				var res = await rp({uri:"https://graph.facebook.com/"+app.config.fbGraphVersion+"/"+pageName+"?access_token="+token+"&fields=fan_count",json: true});

			resolve(res.fan_count);
		}
		else {
				resolve(0);
		}
		});
	};

	oracleManager.youtubeAbos = async function (idPost) {
		return new Promise(async (resolve, reject) => {
			var res = await rp({uri:'https://www.googleapis.com/youtube/v3/videos',qs:{id:idPost,key:app.config.gdataApiKey,part:"snippet"},json: true});
			var channelId = res.items[0]?.snippet.channelId;
			var res = await rp({uri:'https://www.googleapis.com/youtube/v3/channels',qs:{id:channelId,key:app.config.gdataApiKey,part:"statistics"},json: true});
			resolve(res.items[0].statistics.subscriberCount);
		});
	};

	oracleManager.instagramAbos = async function (idPost) {
		return new Promise(async (resolve, reject) => {

		var followers=0;
		var campaign_link = await app.db.campaign_link().findOne({idPost});
		var userWallet=await app.db.wallet().findOne({"keystore.address":campaign_link.id_wallet.toLowerCase().substring(2)})

 		var fbPage = await app.db.fbPage().findOne({$and:[{UserId:userWallet.UserId },{ instagram_id: { $exists: true} }]});
				var instagram_id=fbPage.instagram_id;
				var fbProfile = await app.db.fbProfile().findOne({UserId:userWallet.UserId });
						var token = fbProfile.accessToken;
						var res = await rp({uri:"https://graph.facebook.com/"+app.config.fbGraphVersion+"/"+instagram_id+"?access_token="+token+"&fields=followers_count",json: true});
						followers=res.followers_count
					
			
			
				resolve(followers)
			
		

		});
	};

	oracleManager.twitterAbos = async function (pageName,idPost) {
		return new Promise(async (resolve, reject) => {

			var tweet_res = await tweet.get('statuses/show',{id:idPost});
			resolve(tweet_res.user.followers_count);
		});
	};





	oracleManager.facebook = async function (pageName,idPost) {
		return new Promise(async (resolve, reject) => {

			var page = await app.db.fbPage().findOne({username: pageName});
			if(page) {
				var token = page.token;
				var idPage = page.id;

				var res2 = await rp({uri:"https://graph.facebook.com/"+app.config.fbGraphVersion+"/"+idPage+"_"+idPost+"?fields=shares,full_picture&access_token="+token,json: true});
				var res3 = await rp({uri:"https://graph.facebook.com/"+app.config.fbGraphVersion+"/"+idPage+"_"+idPost+"/insights?metric=post_reactions_by_type_total,post_impressions&period=lifetime&access_token="+token,json: true});

					var shares = 0;
					if(res2.error || res3.error)
					{
						reject({error:"Invalid url"});
						return;
					}
					if(res2.shares)
					{
						shares = res2.shares.count;
					}
					var likes = res3.data[0].values[0].value.like;
					var views = res3.data[1].values[0].value;
					var perf = {shares:shares,likes:likes,views:views,date:Math.floor(Date.now()/1000),media_url:res2.full_picture};

					resolve(perf);
				}

				else {
					resolve({shares:0,likes:0,views:0});
			}

		})
	};



	oracleManager.youtube = async function (idPost) {
		return new Promise(async (resolve, reject) => {
			if( -1 != idPost.indexOf("&"))
			{
				idPost = idPost.split("&")[0];
			}
			var perf = {shares:0,likes:0,views:0};
			var body = await rp({uri:'https://www.googleapis.com/youtube/v3/videos',qs:{id:idPost,key:app.config.gdataApiKey,part:"statistics"}});
			var res = JSON.parse(body);
			if(res.items && res.items[0])
			{
				perf = {shares:0/*res.items[0].statistics.commentCount*/,likes:res.items[0].statistics.likeCount,views:res.items[0].statistics.viewCount,date:Math.floor(Date.now()/1000)};
		 }

			resolve(perf);
		})

	};
oracleManager.getInstagramUserName= async function(shortcode){
	return new Promise(async (resolve, reject) => {
		var media = "https://api.instagram.com/oembed/?callback=&url=https://www.instagram.com/p/"+shortcode;
		var resMedia = await rp({uri:media,json: true});
		resolve(resMedia.author_name);
	})			
}
	oracleManager.instagram = async function (UserId,idPost) {
		return new Promise(async (resolve, reject) => {
			var perf = {shares:0,likes:0,views:0,media_url:''};
		
			let instagramUserName=await app.oracle.getInstagramUserName(idPost);
				
			var fbPage = await app.db.fbPage().findOne({instagram_username: instagramUserName});

			if(fbPage && fbPage.instagram_id){
			var instagram_id=fbPage.instagram_id;
			var fbProfile = await app.db.fbProfile().findOne({UserId: UserId});
			var accessToken=fbProfile.accessToken;
			var media = "https://graph.facebook.com/"+app.config.fbGraphVersion+"/"+instagram_id+"/media?fields=like_count,shortcode,media_url&limit=50&access_token="+accessToken;
			var resMedia = await rp({uri:media,json: true});
			var data =resMedia.data;
			console.log("data====",data)
			for (let i=0;i<data.length;i++){
				if(data[i].shortcode == idPost){
					perf.likes=data[i].like_count;
					perf.media_url=data[i].media_url;
						await app.db.ig_media().updateOne({id:data[i].id},{$set:{shortcode:data[i].shortcode,like_count:data[i].like_count,owner:instagram_id}},{ upsert: true });
						break;	
					}
			}
			}



			resolve(perf);
			return;
				}
		)
	};

	oracleManager.twitter = async function (userName,idPost) {

		return new Promise(async (resolve, reject) => {

			  var twitterProfile = await app.db.twitterProfile().findOne({username:userName  });

				if(!twitterProfile)
				{
					var tweet = new Twitter({
						consumer_key: app.config.twitter.consumer_key_alt,
						consumer_secret: app.config.twitter.consumer_secret_alt,
						access_token_key: app.config.access_token_key,
						access_token_secret: app.config.access_token_secret
					});
					var res = await tweet.get('statuses/show',{id:idPost,'expansions':'attachments.media_keys','media.fields':'duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text'});
					var perf = {shares:res.retweet_count,likes:res.favorite_count,views:0,date:Math.floor(Date.now()/1000),media_url:res.includes?.media[0]?.url};
					resolve(perf);
					return;
				}


			var tweet = new Twitter2({
			  consumer_key: app.config.twitter.consumer_key,
			  consumer_secret: app.config.twitter.consumer_secret,
			  access_token_key: twitterProfile.access_token_key,
			  access_token_secret: twitterProfile.access_token_secret
			});
			
			var res = await tweet.get('tweets' ,{ids:idPost,'tweet.fields':"public_metrics,non_public_metrics",'expansions':'attachments.media_keys','media.fields':'duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text'});
			

			if(res.errors)
			{
				res = await tweet.get('tweets' ,{ids:idPost,'tweet.fields':"public_metrics",'expansions':'attachments.media_keys','media.fields':'duration_ms,height,media_key,preview_image_url,public_metrics,type,url,width,alt_text'});


				var perf = {shares:res.data[0].public_metrics.retweet_count,likes:res.data[0].public_metrics.like_count,date:Math.floor(Date.now()/1000),media_url:res.includes?.media[0]?.url};
				resolve(perf);
				return;
			}


			var perf = {shares:res.data[0].public_metrics.retweet_count,likes:res.data[0].public_metrics.like_count,views:res.data[0].non_public_metrics.impression_count,date:Math.floor(Date.now()/1000),media_url:res.includes?.media[0]?.url};



			resolve(perf);
		})
	};

	oracleManager.verifyFacebook = async function (userId,pageName) {
		return new Promise(async (resolve, reject) => {
			try {
				var page = await app.db.fbPage().findOne({username: pageName,UserId:userId});
				resolve(page);

			}catch (err) {
				reject({message:err.message});
			}
		})
	}

	oracleManager.verifyYoutube = async function (userId,idPost) {
		return new Promise(async (resolve, reject) => {
			try {
				var googleProfile = await app.db.googleProfile().findOne({UserId:userId  });


				var res = await rp({uri:'https://www.googleapis.com/youtube/v3/videos',qs:{id:idPost,access_token :googleProfile.accessToken,part:"snippet"},json: true});

				if(res.items) {
					var channelId = res.items[0]?.snippet.channelId;
					var googleProfile = await app.db.googleProfile().findOne({UserId:userId,channelId:channelId  });
					resolve(googleProfile);
			  }
				else {
					resolve(false);
				}

			}catch (err) {
				reject({message:err.message});
			}
		})
	}
	oracleManager.verifyInsta = async function (userId,idPost) {

		return new Promise(async (resolve, reject) => {

			try {

				var media = "https://api.instagram.com/oembed/?callback=&url=https://www.instagram.com/p/"+idPost;

				var resMedia = await rp({uri:media,json: true});

				page = await app.db.fbPage().findOne({$and:[{UserId:userId  },{instagram_username:resMedia.author_name}]});

				if (page)

				resolve(true);

				else 

				resolve(false);

			}catch (err) {

				reject({message:err.message});

			}

		})

	}

	oracleManager.verifyTwitter = async function (userId,idPost) {
		return new Promise(async (resolve, reject) => {
			try {
				var twitterProfile = await app.db.twitterProfile().findOne({UserId:userId  });
				var tweet = new Twitter2({
				  consumer_key: app.config.twitter.consumer_key,
				  consumer_secret: app.config.twitter.consumer_secret,
				  access_token_key: twitterProfile.access_token_key,
				  access_token_secret: twitterProfile.access_token_secret
				});
				var res = await tweet.get('tweets' ,{ids:idPost,'tweet.fields':"author_id"});
				resolve(res.data[0].author_id == twitterProfile.id)

			}catch (err) {
				reject({message:err.message});
			}
		})
	}


	oracleManager.getPromDetails = async function (idProm) {
		return new Promise(async (resolve, reject) => {
		try {
		var ctr = await app.campaign.getPromContract(idProm);
		if(ctr){
			ctr.methods.proms(idProm).call().then(function (results) {
			resolve(results);
			});
			};
		}catch (err) {
			reject({message:err.message});
		}
		})
	};
	oracleManager.findBountyOracle=(typeSN)=>{
       let oracle;
	   if(typeSN == "1") oracle = 'facebook'
	   if(typeSN == "2") oracle = 'youtube'
	   if(typeSN == "3") oracle = 'instagram'
	   if(typeSN == "4")oracle = 'twitter'
	  return oracle
	}

	app.oracle = oracleManager;
	return app;
}
