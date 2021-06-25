module.exports = function (app) {
	app.get("/youtube/:id", async function (req, response) {
		var id = req.params.id;
		var res = await app.oracle.youtube(id);
		response.end(JSON.stringify(res));
	});

	app.get("/facebook", async function (req, response) {
		var url = req.query.url;
		var parts = url.split("/");
		var pageName = parts[3];
		var idPost = parts[5];

		var res = await app.oracle.facebook(pageName, idPost);
		response.end(JSON.stringify(res));
	});

	app.get("/instagram/:id", async function (req, response) {

		var res = await app.oracle.instagram(req.params.id);
		response.end(JSON.stringify(res));
	});

	app.get("/twitter/:user/:id", async function (req, response) {
		var res = await app.oracle.twitter(req.params.user, req.params.id);
		response.end(JSON.stringify(res));
	});

	app.get("/count/youtube/:id", async function (req, response) {
		var id = req.params.id;
		var res = await app.oracle.youtubeAbos(id);
		response.end(""+res);
	});

	app.get("/count/facebook/:user/:id", async function (req, response) {


		var res = await app.oracle.facebookAbos(req.params.user, req.params.id);
		response.end(""+res);
	});

	app.get("/count/instagram/:id", async function (req, response) {

		var res = await app.oracle.instagramAbos(req.params.id);
			response.end(""+res);
	});

	app.get("/count/twitter/:user/:id", async function (req, response) {
		var res = await app.oracle.twitterAbos(req.params.user, req.params.id);
		response.end(""+res);
	});


/**
* @swagger
* /SaTT/bridge:
*   post:
*     summary: SaTT Bridge .
*     description: BEP20 to ERC20 or the inverse (ETB,BTE).
*     parameters:
*        - name: access token (access_T)
*          description: authentication token (Direction)
*        - name: Direction ETB (Erc20 to Bep20) , BTE (Bep20 to Erc20)
*          description: the direction of the conversion
*        - name:  password (pass)
*          description: wallet password
*        - name: amount
*          description: amount of satt User want to convert in *(wei)
*     responses:
*        "200":
*          description: Transaction details
*        "auth error":
*          description: access token dosn't match
*        "wrong password":
*          description: wrong wallet password (it's impossible to get it back in case you forgot it )
*		example:   #Transaction
*               token:d1c466f447abd9bbf29e7e996da557600a3ab8afd96417fc96987021335c0231
*               direction:ETB
*               password:64487343745
*               amount:1000000000000000000
*
*/
		app.post("/SaTT/bridge", async function (req, res) {
			let access_T = req.body.token;
			let Direction = req.body.direction;
			let pass = req.body.password;
			let amount = req.body.amount;
			var sattContract=app.config.ctrs.token.address.mainnet;
			if(app.config.testnet){
				sattContract=app.config.ctrs.token.address.testnet
			}
			try {
				var auth = await app.crm.auth(access_T);

				var ret;
				if (Direction == "ETB") {
					var cred = await app.account.unlock(auth.id,pass);

					ret = await app.erc20.transfer(
						sattContract,
						app.config.bridge,
						amount,
						cred
					);
				} else if (Direction == "BTE") {
					var cred = await app.account.unlockBSC(auth.id,pass);
					ret = await app.bep20.transferBEP(app.config.bridge, amount, cred);
				}
				if(ret.transactionHash){
					let notification={
						idNode:"0"+auth.id,
						type:"convert_event",
						status:"done",
						label:{amount,Direction},
						isSeen:false,
						isSend:false,
						attachedEls:{
							id:auth.id
					  },
					  created:new Date()
					}
					await app.db.notification().insertOne(notification);
				}

				res.end(JSON.stringify(ret));
			} catch (err) {
				res.end(JSON.stringify(err));
			} finally {
				if (cred) app.account.lock(cred.address);
			}
		});

		app.get("/link/verify/:typeSN/:idUser/:idPost", async function (req, response) {
			var userId = req.session.user;
			var typeSN = req.params.typeSN;
			var idUser = req.params.idUser;
			var idPost = req.params.idPost;
			if(!userId)
				response.end('{error:"no user session"}')
			var linked = false;
			var res = false;
			switch (typeSN) {
				case "1":
					fbProfile = await app.db.fbProfile().findOne({UserId:userId  });
				  if(fbProfile) {
						linked = true;
						res = await app.oracle.verifyFacebook(userId,idUser);
					}
				break;
				case "2":
					googleProfile = await app.db.googleProfile().findOne({UserId:userId });
	        if(googleProfile) {
						linked = true;
						res = await app.oracle.verifyYoutube(userId,idPost);
					}
				break;
				case "3":
				fbProfile = await app.db.fbProfile().findOne({UserId:userId  });
				if(fbProfile && fbProfile.instagram_id) {
					linked = true;
					res = await app.oracle.verifyInsta(userId,idPost);
				}
				break;
				case "4":
				var twitterProfile = await app.db.twitterProfile().findOne({UserId:userId  });
					if(twitterProfile) {
						linked = true;
						res = await app.oracle.verifyTwitter(userId,idPost);
					}

				break;
				default:

			}
			if(!linked)
				response.end('{error:"account not linked"}')
			else
				response.end('{result:'+(res?"true":"false")+'}');
		});



	app.get("/", function (req, response) {
		response.render("index");
	});

	return app;
};
