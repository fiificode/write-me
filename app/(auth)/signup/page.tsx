'use client';
import Image from 'next/image';
import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Writeup"
            width={80}
            height={80}
            className="h-20 w-auto"
          />
        </div>
        <SignUp
          path="/signup"
          routing="path"
          signInUrl="/login"
          appearance={{
            elements: {
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
            },
          }}
        />
      </div>
    </div>
  );
}
