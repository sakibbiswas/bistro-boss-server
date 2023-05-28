const express = require('express')
const app = express()
const cors = require('cors')

const port = process.env.PORT || 4000;
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middlewire
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.db_users}:${process.env.db_pass}@cluster0.yk6uldw.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const MenuCollection = client.db("destroyDB").collection("menu");
        const ReviewsCollection = client.db("destroyDB").collection("reviews");
        const CartCollection = client.db("destroyDB").collection("carts");

        //menu
        app.get('/menu', async (req, res) => {
            const result = await MenuCollection.find().toArray();
            res.send(result)
        })
        //reviews
        app.get('/reviews', async (req, res) => {
            const result = await ReviewsCollection.find().toArray();
            res.send(result)
        })

        //cart collection api
        // step 2
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const query = { email: email };
            const result = await CartCollection.find(query).toArray();
            res.send(result)
        })
        // step 1
        app.post('/carts', async (req, res) => {
            const item = req.body;
            console.log(item);
            const result = await CartCollection.insertOne(item)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




/*  =========================
        Naming Convention
    =========================

    users :usercollection
    app.get('\users')
    app.get('\users\:id')
    app.post('\users')
    app.patch('\users\:id')
    app.delete('\users\:id')
*/



app.get('/', (req, res) => {
    res.send('boss is running');
})

app.listen(port, () => {
    console.log(` boss API is running  on port : ${port}`);
})