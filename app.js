
(async function() {

	try {
		var express = require('express');
		var app = express();
		app.use('/assets', express.static('public'))
		app.set('view engine', 'ejs');
		app = await require("./conf/config")(app);
		app = await require("./conf/const")(app);

		app = await require("./db/db")(app);
		app = await require("./crm/crm")(app);
		app = await  require("./express/https")(app);
		app = await require("./fb/fb_init")(app);
		app = await require("./manager/oracle")(app);
		app = await require("./web3/provider")(app);
		app = await require("./manager/account")(app);
		app = await require("./web3/oracle")(app);
		app = await require("./manager/campaigncentral")(app);
		//app = await require("./web3/campaign")(app);
		app = await require("./web3/satt")(app);
		app = await require("./web3/eth")(app);
		app = await require("./web3/erc20")(app);

		app.use(function(req, res, next) {
		  res.header("content-type","application/json");
		  res.header("Access-Control-Allow-Origin", "*");
		  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		  next();
		});
		app = await require("./express/login")(app);
		app = await require("./express/service")(app);
		//app = await require("./express/campaign")(app);
		app = await require("./express/campaigncentral")(app);
		app = await require("./express/statscentral")(app);
		//app = await require("./express/stats")(app);
		app = await require("./express/wallet")(app);
		app = await require("./express/main")(app);
		app = await require("./web3/initcontracts")(app);
	} catch (e) {
		console.log(e.stack);
	} finally {

	}

})();
