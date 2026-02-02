/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    // We need to allow images from Supabase to load
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**', // Allow all HTTPS images (simplest for MVP)
        },
      ],
    },
  };
  
  export default nextConfig;