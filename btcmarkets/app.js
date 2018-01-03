var secrets    = require('./secrets.json'),
    BTCMarkets = require('btc-markets'),
    mongoose   = require('mongoose'),
    Tick       = require('./models/ticks'),
    Calc       = require('./models/calcs'),
    helperCalc = require('./helpers/calculations');

// web server stuff
var express       = require('express'),
    app           = express(),
    bodyParser    = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
    

var client = new BTCMarkets(secrets.api_key, secrets.api_secret);

var numberConverter = 100000000;    // one hundred million

var mongoUrl  = process.env.DATABASEURL || "mongodb://localhost/cryptotrader";
mongoose.connect(mongoUrl);


client.getAccountBalances(function(err, data)
{
    if (err){
        console.log(err.message);
    }
    else {
        console.log('\n\n');
        data.forEach(function(account)
        {
            console.log(account.currency + ' balance ' + account.balance / numberConverter + ' pending ' + account.pendingFunds / numberConverter);
        });
        console.log('\n\n\n');
    }
});


function capturePriceData(btcclient, crypto, currency) {
    btcclient.getTick(crypto, currency, function(err, data)
    {
        if(!err){
            var timestamp = new Date(Date.now());
            console.log(crypto + ' tick captured ... ' + timestamp.toISOString().replace(/T/, ' ').replace(/\..+/, ''));
            Tick.create(data, function(err, newData){
                if (err) { console.log(err.message)}
            });
        } else { console.log(err.message); }
    });
}

function analysePriceData(crypto) {
    // retrieve last 1000 sample limit at 10 minutes sample intervals (~7 days)
    var priceArray  = [];
    var queryPrices = Tick.find({'instrument': crypto}).sort({'timestamp': -1}).limit(1000);

    queryPrices.exec(function (err, latestTicks){
        if (err) {
            console.log(err.message);
        } else {
            // push lastPrice to local array
            latestTicks.forEach(function(price){
                priceArray.push(price.lastPrice);
            });

            // lets get max / min for last 1000 samples
            var min    = Math.min.apply(null, priceArray ),
                max    = Math.max.apply(null, priceArray );
                latest = priceArray[0];
            // console.log(crypto + ' min: ' + min + ' max: ' + max + ' latest: ' + latest);
            var timestamp = new Date(Date.now());
            console.log(crypto + ' analysed ... ' + timestamp.toISOString().replace(/T/, ' ').replace(/\..+/, ''));

            helperCalc.updateCalc(crypto, min, max, latest);
        }
    });
}

setInterval(capturePriceData.bind(null, client, "BTC", "AUD"), 60000); // 600000 (10 minutes)
setInterval(capturePriceData.bind(null, client, "ETH", "AUD"), 60000);
setInterval(capturePriceData.bind(null, client, "LTC", "AUD"), 60000);
setInterval(capturePriceData.bind(null, client, "BCH", "AUD"), 60000);
setInterval(capturePriceData.bind(null, client, "XRP", "AUD"), 60000);
setInterval(capturePriceData.bind(null, client, "ETC", "AUD"), 60000);

setInterval(analysePriceData.bind(null, "BTC"), 90000); //900000 (15 minutes)
setInterval(analysePriceData.bind(null, "ETH"), 90000);
setInterval(analysePriceData.bind(null, "LTC"), 90000);
setInterval(analysePriceData.bind(null, "BCH"), 90000);
setInterval(analysePriceData.bind(null, "XRP"), 90000);
setInterval(analysePriceData.bind(null, "ETC"), 90000);


// start the web server
var indexRoutes = require('./routes/index');

app.use(indexRoutes);
app.listen(5000, function(){
    console.log("Crypto Trader Server Started");
});