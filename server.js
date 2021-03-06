'use strict';

var mongoose = require('mongoose');
var dbsObject = {};
var models = require('./helpers/models')(dbsObject);
var dbsNames = {};
var connectOptions;
var mainDb;
var app;

require('pmx').init();

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./config/environment/' + process.env.NODE_ENV);

// replset & mongos are needed when database was split in to replSet and shards
connectOptions = {
    db    : {native_parser: true},
    server: {poolSize: 5},
    // replset: { rs_name: 'myReplicaSetName' },
    //user  : process.env.DB_USER,
    //pass  : process.env.DB_PASS,
    w     : 1,
    j     : true
    // mongos: true
};
mainDb = mongoose.createConnection(process.env.MAIN_DB_HOST, process.env.MAIN_DB_NAME, process.env.DB_PORT, connectOptions);
mainDb.on('error', function (err) {
    err = err || 'connection error';
    process.exit(1, err);
});
mainDb.once('open', function callback() {
    var mainDBSchema;
    var port = parseInt(process.env.PORT, 10) || 8089;
    var instance = parseInt(process.env.NODE_APP_INSTANCE, 10) || 0;
    var main;

    port += instance;
    mainDb.dbsObject = dbsObject;

    console.log('Connection to mainDB is success');

    require('./models/index.js');

    mainDBSchema = mongoose.Schema({
        _id   : Number,
        url   : {type: String, default: 'localhost'},
        DBname: {type: String, default: ''},
        pass  : {type: String, default: ''},
        user  : {type: String, default: ''},
        port  : Number
    }, {collection: 'easyErpDBS'});

    main = mainDb.model('easyErpDBS', mainDBSchema);
    main.find().exec(function (err, result) {
        if (err) {
            process.exit(1, err);
        }

        result.forEach(function (_db, index) {
            var dbInfo = {
                DBname: '',
                url   : ''
            };
            var opts = {
                db    : {native_parser: true},
                server: {poolSize: 5},
                // replset: { rs_name: 'myReplicaSetName' },
                //user  : _db.user,
                //pass  : _db.pass,
                w     : 1,
                j     : true
                // mongos: true
            };
            var dbObject = mongoose.createConnection(_db.url, _db.DBname, _db.port, opts);
            var Scheduler = require('./services/scheduler')(models);

            dbObject.on('error', function (err) {
                console.error(err);
            });
            dbObject.once('open', function () {
                var scheduler = new Scheduler(_db.DBname);

                console.log('Connection to ' + _db.DBname + ' is success' + index);
                dbInfo.url = result[index].url;
                dbInfo.DBname = result[index].DBname;
                dbsObject[_db.DBname] = dbObject;
                dbsNames[_db.DBname] = dbInfo;

                scheduler.initEveryDayScheduler();
            });
        });
    });

    mainDb.mongoose = mongoose;

    app = require('./app')(mainDb, dbsNames);

    app.listen(port, function () {
        console.log('==============================================================');
        console.log('|| server start success on port=' + port + ' in ' + process.env.NODE_ENV + ' version ||');
        console.log('==============================================================\n');
    });
});
