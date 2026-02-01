"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TreviLogoStatic, TreviLogoAnimation } from "@/components/ui/trevi-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, ChevronDown, Search, Check } from "lucide-react";
import { SimpleOnboarding } from "@/components/onboarding/simple-onboarding";
import { setUserMetadata, getUserMetadata, getChats } from "@/lib/api";
import { cn } from "@/lib/utils";

// Country list
const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
    "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
    "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
    "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos",
    "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
    "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova",
    "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau",
    "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
    "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal",
    "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea",
    "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
    "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela",
    "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export function TreviLanding() {
    const router = useRouter();
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        country: "",
    });
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countrySearchQuery, setCountrySearchQuery] = useState("");
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
        const { firstName, lastName, email, country } = formData;
        const isValid =
            firstName.trim().length > 0 &&
            lastName.trim().length > 0 &&
            email.trim().length > 0 &&
            country.trim().length > 0 &&
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
                country: formData.country.trim(),
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
        return <SimpleOnboarding />;
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

                            {/* Country Dropdown */}
                            <div className="space-y-2">
                                <label
                                    htmlFor="country"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700"
                                >
                                    Country
                                </label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 h-12 rounded-md",
                                            "bg-slate-50 border border-slate-200 text-left",
                                            "hover:border-slate-300 hover:bg-slate-100/50 transition-all duration-200",
                                            "focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2",
                                            isCountryDropdownOpen && "ring-2 ring-slate-900 ring-offset-2 border-slate-300"
                                        )}
                                    >
                                        <span className={cn(
                                            "text-sm",
                                            formData.country ? "text-slate-900 font-medium" : "text-slate-400"
                                        )}>
                                            {formData.country || "Select your country"}
                                        </span>
                                        <ChevronDown className={cn(
                                            "w-4 h-4 text-slate-500 transition-transform duration-200",
                                            isCountryDropdownOpen && "rotate-180"
                                        )} />
                                    </button>

                                    {isCountryDropdownOpen && (
                                        <>
                                            {/* Backdrop to close dropdown when clicking outside */}
                                            <div 
                                                className="fixed inset-0 z-40" 
                                                onClick={() => {
                                                    setIsCountryDropdownOpen(false);
                                                    setCountrySearchQuery("");
                                                }}
                                            />
                                            <div className="absolute z-50 w-full mt-2 bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                {/* Search Input */}
                                                <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search countries..."
                                                            value={countrySearchQuery}
                                                            onChange={(e) => setCountrySearchQuery(e.target.value)}
                                                            className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 rounded-md bg-white border border-slate-200 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 placeholder:text-slate-400"
                                                            autoFocus
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                {/* Country List */}
                                                <div className="max-h-52 overflow-y-auto overscroll-contain">
                                                    {COUNTRIES.filter(country =>
                                                        country.toLowerCase().includes(countrySearchQuery.toLowerCase())
                                                    ).length > 0 ? (
                                                        COUNTRIES.filter(country =>
                                                            country.toLowerCase().includes(countrySearchQuery.toLowerCase())
                                                        ).map((country) => (
                                                            <button
                                                                key={country}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData(prev => ({ ...prev, country }));
                                                                    setIsCountryDropdownOpen(false);
                                                                    setCountrySearchQuery("");
                                                                }}
                                                                className={cn(
                                                                    "w-full px-3 py-2.5 text-left text-sm transition-all duration-150 flex items-center justify-between",
                                                                    "hover:bg-slate-100 focus:bg-slate-100 focus:outline-none",
                                                                    formData.country === country
                                                                        ? "bg-slate-900 text-white hover:bg-slate-800 focus:bg-slate-800"
                                                                        : "text-slate-700"
                                                                )}
                                                            >
                                                                <span>{country}</span>
                                                                {formData.country === country && (
                                                                    <Check className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="px-3 py-8 text-sm text-slate-400 text-center">
                                                            <p>No countries found</p>
                                                            <p className="text-xs mt-1">Try a different search term</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
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
