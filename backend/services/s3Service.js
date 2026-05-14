import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { v4 as uuidv4 } from "uuid";

import s3 from "../config/s3.js";


// UPLOAD FILE TO S3
export const uploadFileToS3 = async (
  file,
  folder
) => {
  const fileExtension =
    file.originalname.split(".").pop();

  const key = `${folder}/${uuidv4()}.${fileExtension}`;

  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,

    Key: key,

    Body: file.buffer,

    ContentType: file.mimetype,
  };

  await s3.send(
    new PutObjectCommand(params)
  );

  return {
    key,

    url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${key}`,
  };
};


// DELETE FILE
export const deleteFileFromS3 =
  async (key) => {
    if (!key) return;

    await s3.send(
      new DeleteObjectCommand({
        Bucket:
          process.env.AWS_BUCKET_NAME,

        Key: key,
      })
    );
  };

// GENERATE SIGNED FILE URL
export const generateSignedFileUrl = async (
  key
) => {
  if (!key) return null;

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: "inline",
    ResponseContentType: "application/pdf",
  });

  const signedUrl = await getSignedUrl(
    s3,
    command,
    {
      expiresIn: 60 * 5,
    }
  );

  return signedUrl;
};