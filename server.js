var express             = require('express'),
    app                 = express(),
    passport            = require('passport'),
    FacebookStrategy    = require('passport-facebook').Strategy,
    session             = require('express-session'),
	{ MongoClient, ServerApiVersion, ObjectId } = require("mongodb"),
	formidable 			= require('express-formidable'),
	fsPromises 			= require('fs').promises;

app.set('view engine', 'ejs');

/*MongoDB settings*/
const mongourl = 'mongodb+srv://user01:user01@cluster0.sxofz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const dbName = 'task2';
const collectionName = "bookings";
const client = new MongoClient(mongourl, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const insertDocument = async (db, doc) => {
    var collection = db.collection(collectionName);
    let results = await collection.insertOne(doc);
	console.log("insert one document:" + JSON.stringify(results));
    return results;
}

const findDocument = async (db, criteria) => {
    var collection = db.collection(collectionName);
    let results = await collection.find(criteria).toArray();
	console.log("find the documents:" + JSON.stringify(results));
    return results;
}
const updateDocument = async (db, criteria, updateData) => {
    var collection = db.collection(collectionName);
    let results = await collection.updateOne(criteria, { $set: updateData });
	console.log("update one document:" + JSON.stringify(results));
    return results;
}
const deleteDocument = async (db, criteria) => {
    var collection = db.collection(collectionName);
    let results = await collection.deleteMany(criteria);
	console.log("delete one document:" + JSON.stringify(results));
    return results;
}
/*End of MongoDB settings*/

/*Login*/
var user = {};  
passport.serializeUser(function (user, done) {done(null, user);});
passport.deserializeUser(function (id, done) {done(null, user);});
app.use(session({
    secret: "tHiSiSasEcRetStr",
    resave: true,
    saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new FacebookStrategy({
    "clientID"        : '2311761939200837',
    "clientSecret"    : 'bebdf7e0fa3a22e14a5a1b5d61fb95ce',
    "callbackURL"     : 'http://localhost:8099/auth/facebook/callback'
  },  
  function (token, refreshToken, profile, done) {
    console.log("Facebook Profile: " + JSON.stringify(profile));
    console.log(profile);
    user = {};
    user['id'] = profile.id;
    user['name'] = profile.displayName;
    user['type'] = profile.provider;  
    console.log('user object: ' + JSON.stringify(user));
    return done(null,user);  
  })
);
 
app.use((req,res,next) => {
    let d = new Date();
    console.log(`TRACE: ${req.path} was requested at ${d.toLocaleDateString()}`);  
    next();
});

const isLoggedIn = (req,res,next) => {
    if (req.isAuthenticated())
        return next();
    res.redirect('/login');
}

app.get("/login", function (req, res) {
	res.status(200).render('login');
});
app.get("/auth/facebook", passport.authenticate("facebook", { scope : "email" }));
app.get("/auth/facebook/callback",
    passport.authenticate("facebook", {
        successRedirect : "/content",
        failureRedirect : "/"
}));
/*End of Login*/

/*CRUD handler functions*/
const handle_Create = async (req, res) => {
	await client.connect();
	console.log("Connected successfully to server");
    const db = client.db(dbName);
    let newDoc = {
        userid: req.user.id,
        book: req.fields.bookingid,
        id: req.fields.mobile
    };
    if (req.files.filetoupload && req.files.filetoupload.size > 0) {
        const data = await fsPromises.readFile(req.files.filetoupload.path);
        newDoc.photo = Buffer.from(data).toString('base64');
    }
	await insertDocument(db, newDoc);
    res.redirect('/');
}
const handle_Find = async (req, res, criteria) => {
	await client.connect();
    console.log("Connected successfully to server");
	const db = client.db(dbName);
	const docs = await findDocument(db);
    res.status(200).render('list',{nBookings: docs.length, bookings: docs, user: req.user});
}
const handle_Details = async (req, res, criteria) => {
	await client.connect();
	console.log("Connected successfully to server");
    const db = client.db(dbName);
    let DOCID = { _id: ObjectId.createFromHexString(criteria._id) };
    const docs = await findDocument(db, DOCID);
    res.status(200).render('details', { booking: docs[0], user: req.user});
}
const handle_Edit = async (req, res, criteria) => {
	await client.connect();
	console.log("Connected successfully to server");
    const db = client.db(dbName);
    let DOCID = { '_id': ObjectId.createFromHexString(criteria._id) };
    let docs = await findDocument(db, DOCID);
    if (docs.length > 0 && docs[0].userid == req.user.id) {
        res.status(200).render('edit', { booking: docs[0], user: req.user});
    } else {
        res.status(500).render('info', { message: 'Unable to edit - you are not book owner!', user: req.user});
    }
}
const handle_Update = async (req, res, criteria) => {
		await client.connect();
		console.log("Connected successfully to server");
        const db = client.db(dbName);
        const DOCID = {
            _id: ObjectId.createFromHexString(req.fields._id)
        }
        let updateData = {
            book: req.fields.bookingid,
            id: req.fields.mobile,
        };
        if (req.files.filetoupload && req.files.filetoupload.size > 0) {
            const data = await fsPromises.readFile(req.files.filetoupload.path);
            updateData.photo = Buffer.from(data).toString('base64');
        }
        const results = await updateDocument(db, DOCID, updateData);
		res.status(200).end(`Updated!`);
}
const handle_Delete = async (req, res) => {
	await client.connect();
	console.log("Connected successfully to server");
    const db = client.db(dbName);
    let DOCID = { '_id': ObjectId.createFromHexString(req.query._id) };
    let docs = await findDocument(db, DOCID);
    if (docs.length > 0 && docs[0].userid == req.user.id) {
		await deleteDocument(db, DOCID);
        res.status(200).render('info', { message: `Book: ${docs[0].book} removed.`, user: req.user});
    } else {
        res.status(500).render('info', { message: 'Unable to delete - you are not book owner!', user: req.user});
    }
}
/*End of CRUD handler functions*/

app.use(formidable());

app.get('/', isLoggedIn, (req,res) => {
    res.redirect('/content');
})

app.get("/content", isLoggedIn, function (req, res) {
    //res.render('list', {user: req.user});
	handle_Find(req, res, req.query.docs);
});

app.get('/create', isLoggedIn, (req,res) => {
    res.status(200).render('create',{user:req.user});//Provide the UI `create.ejs`
})
app.post('/create', isLoggedIn, (req, res) => {
    handle_Create(req, res);//Redirect to the home page
});

app.get('/details',isLoggedIn, (req,res) => {
    handle_Details(req, res, req.query);//Provide the UI `details.ejs`
})

app.get('/edit', isLoggedIn, (req,res) => {
    handle_Edit(req, res, req.query);//Provide the UI `edit.ejs` or prvide the UI `info.ejs` if failed the editing
})

app.post('/update', isLoggedIn, (req,res) => {
    handle_Update(req, res, req.query);//Provide the UI `info.ejs`
})

app.get('/delete', isLoggedIn, (req,res) => {
    handle_Delete(req, res);//Provide the UI `info.ejs`
});

app.get("/logout", function(req, res) {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

/* RESTful */
//POST
app.post('/api/book/:id', async (req,res) => { //async programming way
    if (req.params.id) {
        console.log(req.body)
		await client.connect();
		console.log("Connected successfully to server");
	    const db = client.db(dbName);
	    let newDoc = {
	        id: req.fields.id,
	        book: req.fields.book};
	    if (req.files.filetoupload && req.files.filetoupload.size > 0) {
	        const data = await fsPromises.readFile(req.files.filetoupload.path);
	        newDoc.photo = Buffer.from(data).toString('base64');}
		await insertDocument(db, newDoc);
	    res.status(200).json({"Successfully inserted":newDoc}).end();
    } else {
        res.status(500).json({"error": "missing id"});
    }
})
//testing code -> curl -X POST -H "Content-Type: application/json" --data '{"book":"Test","id":"000"}' localhost:8099/api/book/B0

//GET
app.get('/api/book/:id', async (req,res) => { //async programming way
	if (req.params.id) {
		console.log(req.body)
        let criteria = {};
        criteria['id'] = req.params.id;
		await client.connect();
	    console.log("Connected successfully to server");
		const db = client.db(dbName);
		const docs = await findDocument(db, criteria);
	    res.status(200).json(docs);
	} else {
        res.status(500).json({"error": "missing id"}).end();
    }
});
//testing code -> curl -X GET http://localhost:8099/api/book/000

//PUT
app.put('/api/book/:id', async (req,res) => {
    if (req.params.id) {
        console.log(req.body)
		let criteria = {};
        criteria['id'] = req.params.id;
			await client.connect();
			console.log("Connected successfully to server");
		    const db = client.db(dbName);
		    let updateData = {
		        id: req.fields.id || req.params.id,
		        book: req.fields.book,
		    };
		    if (req.files.filetoupload && req.files.filetoupload.size > 0) {
		        const data = await fsPromises.readFile(req.files.filetoupload.path);
		        updateData.photo = Buffer.from(data).toString('base64');
		    }
		    const results = await updateDocument(db, criteria, updateData);
		    res.status(200).json(results).end();
    } else {
        res.status(500).json({"error": "missing id"});
    }
})
//testing code -> curl -X PUT -H "Content-Type: application/json" --data '{"id":"111"}' localhost:8099/api/book/B0

//DELETE
app.delete('/api/book/:id', async (req,res) => {
    if (req.params.id) {
		console.log(req.body)
		let criteria = {};
        criteria['id'] = req.params.id;
		await client.connect();
		console.log("Connected successfully to server");
	    const db = client.db(dbName);
	    const results = await deleteDocument(db, criteria);
        console.log(results)
	    res.status(200).json(results).end();
    } else {
        res.status(500).json({"error": "missing id"});       
    }
})
//testing code -> curl -X DELETE localhost:8099/api/book/000
/* End of RESTful */

app.get('/*', (req,res) => {
    res.status(404).render('info', {message: `${req.path} - Unknown request!` });
})

const port = process.env.PORT || 8099;
app.listen(port, () => {console.log(`Listening at http://localhost:${port}`);});
