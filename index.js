const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-module58.web.app",
      "https://job-portal-module58.firebaseapp.com",
    ],

    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log("secret", token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  console.log(process.env.JWT_SECRET);
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "forbidden Access" });
    }

    req.user = decoded;

    next();
  });
};

//===============================================================================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w7smd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    //(jwt related apis)=========================================================
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "1h" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    //(jobs related apis)=========================================================
    const jobsCollection = client.db("jobPortal").collection("jobs");

    // all jobs get api
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    // jobs get by email api
    app.get("/job", async (req, res) => {
      const email = req.query.email;
      const query = { hr_email: email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // jobs get by id api
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // jobs post api
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    //(applications related apis)=================================================
    const applicationsCollection = client
      .db("jobPortal")
      .collection("applications");

    // applications get by email
    app.get("/application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      // console.log(req.user.email, email);
      // if (req.user.email !== email) {
      //   return res.status(403).send({ message: "Forbidden Access" });
      // }

      const result = await applicationsCollection.find(query).toArray();
      for (application of result) {
        const query1 = { _id: new ObjectId(application.job_id) };
        const job = await jobsCollection.findOne(query1);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.location = job.location;
          application.company_logo = job.company_logo;
        }
      }
      res.send(result);
    });

    // applications get by job_id
    app.get("/job-applications/jobs/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // applications post api & added applicationCount property to jobs datas
    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);

      //applicationCount property add to the job datas
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobsCollection.findOne(query);
      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      } else {
        newCount = 1;
      }
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { applicationCount: newCount } };
      const updateResult = await jobsCollection.updateOne(filter, updateDoc);

      res.send(result);
    });

    //patch applications datas api (status property added)
    app.patch("/applications/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { status: data.status } };
      const result = await applicationsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);
//===============================================================================

app.get("/", (req, res) => {
  res.send("job portal site ");
});

app.listen(port, () => {
  console.log(` job portal site is running ${port}`);
});
