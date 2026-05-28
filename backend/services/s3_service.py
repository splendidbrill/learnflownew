import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

S3_BUCKET = os.environ.get("S3_BUCKET", "learnflow-pdfs-prod")
S3_REGION = os.environ.get("AWS_REGION", "us-east-1")
CLOUDFRONT_URL = os.environ.get("CLOUDFRONT_URL", "https://d2a0zmwfvizybo.cloudfront.net")

s3 = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
)

def upload_file_to_s3(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes to S3 and return the CloudFront URL."""
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"{CLOUDFRONT_URL}/{key}"

def get_cloudfront_url(key: str) -> str:
    """Get CloudFront URL for an existing S3 key."""
    return f"{CLOUDFRONT_URL}/{key}"

def delete_file_from_s3(key: str):
    """Delete a file from S3."""
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=key)
    except ClientError as e:
        print(f"❌ S3 delete error: {e}")
