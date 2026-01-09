"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TreviLogoStatic, TreviLogoAnimation } from "@/components/ui/trevi-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { setUserMetadata, getUserMetadata, getChats } from "@/lib/api";

export function TreviLanding() {
    const router = useRouter();
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
    });
    const [isFormValid, setIsFormValid] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showTour, setShowTour] = useState(false);

    // Check if user has already completed onboarding on mount
    useEffect(() => {
        const checkUserStatus = async () => {
            try {
                // Hit both APIs simultaneously as required
                const [userMetadata] = await Promise.all([
                    getUserMetadata(),
                    getChats(), // Also hit chats API as per requirement
                ]);

                // If user has already completed onboarding, redirect to home
                if (userMetadata.has_user_info) {
                    router.replace('/');
                    return;
                }
            } catch (error) {
                console.error("Failed to check user status:", error);
                // On error, allow them to proceed with onboarding
            } finally {
                setIsCheckingAuth(false);
            }
        };

        checkUserStatus();
    }, [router]);

    useEffect(() => {
        const { firstName, lastName, email } = formData;
        const isValid =
            firstName.trim().length > 0 &&
            lastName.trim().length > 0 &&
            email.trim().length > 0 &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        setIsFormValid(isValid);
    }, [formData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        // Clear error when user starts typing
        if (submitError) setSubmitError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid || isSubmitting) return;

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Call API to store user metadata
            await setUserMetadata({
                email: formData.email.trim(),
                first_name: formData.firstName.trim(),
                last_name: formData.lastName.trim(),
            });

            console.log("User metadata saved successfully");
            setShowTour(true);
        } catch (error) {
            console.error("Failed to save user metadata:", error);
            setSubmitError("Failed to save your information. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show loading while checking if user has already onboarded
    if (isCheckingAuth) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-6">
                    <TreviLogoAnimation size={120} />
                    <p className="text-slate-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (showTour) {
        return (
            <OnboardingTour
                onComplete={() => {
                    console.log("Tour Completed, navigating to app...");
                    // Setup redirect or callback here
                    // For now, reload or just hide tour to simulate 'entered'
                    // or we could use router.push('/app') if that existed
                    window.location.href = '/';
                }}
                onSkip={() => {
                    window.location.href = '/';
                }}
            />
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col lg:flex-row">
            {/* Left Side - Branding (60-65% width) - Light Theme */}
            <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-4 py-12 lg:w-[65vw] lg:px-12 relative overflow-hidden text-slate-900">

                <div className="flex flex-col items-center max-w-3xl w-full space-y-8 lg:space-y-12 z-10">
                    {/* Welcome Text */}
                    <p className="text-slate-500 text-xs lg:text-sm tracking-widest uppercase font-medium animate-in fade-in slide-in-from-bottom-4 duration-700">
                        Welcome to Trevi Pilot Test
                    </p>

                    {/* Massive Trevi Pill - White with Shadow, Static Logo */}
                    {/* Mobile: smaller padding, smaller logo, smaller text */}
                    <div className="flex items-center gap-4 lg:gap-8 mx-4 animate-in zoom-in-95 duration-1000">
                        {/* Logo: Responsive size controlled via class hidden/block or just fixed for mobile/desktop? 
                The size prop is number, hard to make responsive unless we conditionally render or just pick a middle ground.
                Better to use explicit width/height in className or style if component supports it, but component uses style width/height.
                Let's use a responsive wrapper or state. Or just two logos hidden/shown. Component doesn't seem to pass className to svg directly for size, but to container.
                Wait, component takes `size` and sets style width/height. 
                I will duplicate for simplicity of responsive design control or use a custom component that accepts responsive classes if needed.
                Actually, let's just use two logos for now to be perfectly precise with simple props.
            */}

                        <div className="hidden lg:block">
                            <TreviLogoStatic size={160} className="bg-slate-900 text-white" />
                        </div>
                        <div className="block lg:hidden">
                            <TreviLogoStatic size={60} className="bg-slate-900 text-white" />
                        </div>

                        <h1 className="text-5xl lg:text-[9rem] font-bold text-slate-900 leading-none tracking-tighter" style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}>
                            trevi
                        </h1>
                    </div>

                    {/* Tagline */}
                    <p className="text-slate-600 text-lg lg:text-2xl font-light tracking-wide animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 text-center">
                        explore your <span className="text-blue-600 font-medium">curiosity</span>
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="flex w-full flex-1 flex-col items-center justify-center bg-white px-8 py-12 lg:px-16 border-l border-slate-100">
                <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                            Get Started
                        </h2>
                        <p className="text-slate-500">
                            Enter your details to begin exploring.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label
                                        htmlFor="firstName"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
                                    >
                                        First Name
                                    </label>
                                    <Input
                                        id="firstName"
                                        name="firstName"
                                        placeholder="Jane"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        className="bg-slate-50 border-slate-200 h-12"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label
                                        htmlFor="lastName"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
                                    >
                                        Last Name
                                    </label>
                                    <Input
                                        id="lastName"
                                        name="lastName"
                                        placeholder="Doe"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        className="bg-slate-50 border-slate-200 h-12"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="email"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
                                >
                                    Email
                                </label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="jane@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="bg-slate-50 border-slate-200 h-12"
                                />
                            </div>
                        </div>

                        {/* Error message */}
                        {submitError && (
                            <p className="text-sm text-red-600 text-center">
                                {submitError}
                            </p>
                        )}

                        <Button
                            type="submit"
                            disabled={!isFormValid || isSubmitting}
                            className="w-full h-12 text-base group bg-slate-900 hover:bg-slate-800"
                            size="lg"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Start Exploring
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
