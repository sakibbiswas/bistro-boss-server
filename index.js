const express = require('express')
const app = express()
const cors = require('cors')

const port = process.env.PORT || 4000;
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require("stripe")(process.env.payment_secret_key)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middlewire
app.use(cors())
app.use(express.json())

// let transporter = nodemailer.createTransport({
//     host: 'smtp.sendgrid.net',
//     port: 587,
//     auth: {
//         user: "apikey",
//         pass: process.env.SENDGRID_API_KEY
//     }
// })

const auth = {
    auth: {
        api_key: process.env.EMAIL_PRIVATE_KEY,
        domain: process.env.EMAIL_DOMAIN
    }
}

const transporter = nodemailer.createTransport(mg(auth));


// send payment confirmation email
const sendPaymentConfirmationEmail = payment => {
    transporter.sendMail({
        from: "sakibsakib99880@gmail.com", // verified sender email
        to: "sakibsakib99880@gmail.com", // recipient email
        subject: "Your order is confirmed .Enjoy the food soon", // Subject line
        text: "Hello world!", // plain text body
        html: `<div>
        <h2>Payment confirmed</h2>
        <p>transactionId : ${payment.transactionId}</p>
        <p>price : ${payment.price}</p>

        </div>`,
    }, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

}



const uri = `mongodb+srv://${process.env.db_users}:${process.env.db_pass}@cluster0.yk6uldw.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifyJWT = (req, res, next) => {
    // console.log('hitting');
    // console.log(req.headers.authorization);
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    //bearer token
    const token = authorization.split(' ')[1]
    // console.log('token varify jwt', token);
    jwt.verify(token, process.env.access_token_secret, (error, decoded) => {
        if (error) {
            // console.log(error);
            return res.status(401).send({ error: true, message: 'unauthorized access' })

        }
        // console.log(decoded);
        req.decoded = decoded;

        next()
    })
}
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const UsersCollection = client.db("destroyDB").collection("users");
        const MenuCollection = client.db("destroyDB").collection("menu");
        const ReviewsCollection = client.db("destroyDB").collection("reviews");
        const CartCollection = client.db("destroyDB").collection("carts");
        const PaymentsCollection = client.db("destroyDB").collection("payments");

        // jwt 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            // console.log(user)
            const token = jwt.sign(user, process.env.access_token_secret, { expiresIn: '1h' })

            res.send({ token })
        })
        // warning : use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await UsersCollection.findOne(query)
            if (user?.role !== 'admin') {

                return res.status(403).send({ error: true, message: 'forbidden ' })
            }
            next()
        }




        // users related api
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await UsersCollection.find().toArray();
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            // console.log(user);
            const query = { email: user.email }
            const existingUser = await UsersCollection.findOne(query)
            // console.log('existing user', existingUser);
            if (existingUser) {
                return res.send({ message: 'user Already exists' })
            }
            const result = await UsersCollection.insertOne(user)
            res.send(result)
        });
        //security layer: verifyJWT
        // email : same
        // check :admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await UsersCollection.findOne(query)
            const result = { admin: user?.role === 'admin' }
            res.send(result)


        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await UsersCollection.updateOne(filter, updateDoc)
            res.send(result)
        });

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await UsersCollection.deleteOne(query)
            res.send(result)
        })


        //menu related api
        app.get('/menu', async (req, res) => {
            const result = await MenuCollection.find().toArray();
            res.send(result)
        })

        app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
            const newItem = req.body;
            // console.log(item);
            const result = await MenuCollection.insertOne(newItem)
            res.send(result)
        })

        app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await MenuCollection.deleteOne(query)
            res.send(result)
        })



        //reviews
        app.get('/reviews', async (req, res) => {
            const result = await ReviewsCollection.find().toArray();
            res.send(result)
        })

        //cart collection api
        // step 2
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email;
            // const decoded = req.decoded;
            // console.log('came back after varify', decodedEmail);

            if (email !== decodedEmail) {
                return req.status(403).send({ error: 1, message: 'forbidden access' })
            }
            const query = { email: email };
            const result = await CartCollection.find(query).toArray();
            res.send(result)
        })
        // step 1
        app.post('/carts', async (req, res) => {
            const item = req.body;
            // console.log(item);
            const result = await CartCollection.insertOne(item)
            res.send(result)
        })
        // step 2
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await CartCollection.deleteOne(query)
            res.send(result)
        })

        // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            // console.log(price, amount);
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
            console.log(paymentIntent);

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        // payment related api
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log(payment);
            payment.menuItems = payment.menuItems.map(item => new ObjectId(item))
            const insertResult = await PaymentsCollection.insertOne(payment)
            const query = {
                _id: { $in: payment.cartItems.map(id => new ObjectId(id)) }
            }
            const deleteResult = await CartCollection.deleteMany(query)

            // send an email confirming payment
            sendPaymentConfirmationEmail(payment)
            res.send({ insertResult, deleteResult })
        })



        // count related api
        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await UsersCollection.estimatedDocumentCount();
            const products = await MenuCollection.estimatedDocumentCount();
            const orders = await PaymentsCollection.estimatedDocumentCount();


            // best way to sum of the price field is to use group and sum operation
            /*
           awaite paymentcollection.aggregate([
  {
    $group: {
      _id: null,
      totalPrice: { $sum: "$price" }
    }
  }
]).toArray()
 
            */
            const payments = await PaymentsCollection.find().toArray()
            const revenue = payments.reduce((sum, payment) => sum + payment.price, 0)
            res.send({
                users,
                products,
                orders,
                revenue
            })
        });

        // 
        app.get('/order-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const pipeline = [

                {

                    $lookup: {
                        from: "menu",
                        localField: "menuItems",
                        foreignField: "_id",
                        as: "menuItemData",
                    },
                },
                { $unwind: '$menuItemData' },
                {
                    $group: {
                        _id: '$menuItemData.category',
                        itemCount: { $sum: 1 },
                        total: { $sum: { $round: ['$menuItemData.price', 2] } }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        itemCount: 1,
                        total: 1,
                        _id: 0
                    }
                }
            ];
            const result = await PaymentsCollection.aggregate(pipeline).toArray()
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