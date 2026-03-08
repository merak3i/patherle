import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.PINECONE_API_KEY) {
  console.warn('Warning: PINECONE_API_KEY not set in .env');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

export default pinecone;
