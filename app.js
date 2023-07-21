const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const express = require('express');
const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');
const { LocalWorkspace } = require("@pulumi/pulumi/automation");
const path = require('path');


const app = express();
app.use(express.json());

const pulumiProgram = async (content) => {
    const siteBucket = new aws.s3.Bucket("s3-website-bucket", {
        acl: "private",
        website: {
            indexDocument: "index.html",
        },
    });
    console.log('sitenucket',siteBucket)

    const bucketPublicAccessBlock = new aws.s3.BucketPublicAccessBlock("bucketPublicAccessBlock", {
        bucket: siteBucket.id,
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
    });
    console.log('bucketPublicAccessBlock',bucketPublicAccessBlock)


    const bucketPolicy = new aws.s3.BucketPolicy("bucketPolicy", {
        bucket: siteBucket.id,
        policy: siteBucket.id.apply(id => JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${id}/*`],
            }],
        })),
        dependsOn: [bucketPublicAccessBlock], // Wait for bucketPublicAccessBlock to finish
    });
    console.log('bucketPolicy',bucketPolicy)


    new aws.s3.BucketObject("index", {
        bucket: siteBucket.id,
        content: content,
        key: "index.html",
        contentType: "text/html; charset=utf-8",
    });
    return { websiteUrl: pulumi.interpolate `http://${siteBucket.id}.s3-website.us-east-2.amazonaws.com` };
    // return { websiteUrl: siteBucket.websiteEndpoint };
}


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'form.html'));
});


app.post('/v1/code', async (req, res) => {
    console.log(req)
    const { content, projectName, stackName } = req.body;
    const pulumiAccessToken = req.headers.pulumi_access_token;
    // const htmlResponse = req.body.content;
    // process.env.PULUMI_ACCESS_TOKEN = undefined;
    const program = () => pulumiProgram(content);
    try {
        const stack = await LocalWorkspace.createStack({
            stackName: stackName,
            projectName: projectName,
            program: program
        });
        await stack.workspace.installPlugin("aws", "v4.0.0");
        await stack.setConfig("aws:region", { value: "us-east-2" });
        const upRes = await stack.up({ onOutput: console.log });
        // const websiteUrlValue = await upRes.outputs.websiteUrl.promise();
        res.status(200).json({ id: stackName, upRes });





    } catch (error) {
        if (error.message.includes('already exists')) {
            res.status(409).send(`stack '${stackName}' already exists`);
        
        } else {
            res.status(500).send(error.message);
        }
    }
});

app.listen(3004, () => console.log('Server running on port 3000'));

