# 🌾 KisanDirect

KisanDirect is an AI-powered digital marketplace designed to connect **farmers/FPOs directly with bulk buyers**, helping improve market access, price transparency, and logistics efficiency.

## 🚜 Problem

Farmers often face challenges such as:

- Limited access to suitable bulk buyers
- Dependence on multiple intermediaries
- Lack of transparent price information
- Difficulty arranging transportation for smaller quantities
- Delayed or inefficient transactions
- Language barriers for digital platforms

## 💡 Our Solution

KisanDirect provides a single platform where farmers can list their produce and connect with suitable buyers.

### Key Features

- 👨‍🌾 **Farmer Registration**  
  Farmers can create their profiles and list their agricultural produce.

- 📸 **Crop Listing & Image Upload**  
  Farmers can add crop details, quantity, price, and upload/capture crop images.

- 🤖 **AI-Assisted Quality Grading**  
  Gemini Vision API analyses uploaded crop images to provide AI-assisted quality assessment.

- 🛒 **Buyer Requirements**  
  Bulk buyers can specify the crop, required quantity, location, and other requirements.

- 🔗 **Smart Farmer-Buyer Matching**  
  Listings can be matched with buyer requirements based on crop, quantity, location, price, and availability.

- 🚚 **Shared Transportation**  
  Compatible orders from multiple farmers can be combined into a single shipment to reduce unnecessary transportation costs.

- 📊 **Mandi Price Visibility**  
  Users can view nearby mandi prices to make better-informed selling and purchasing decisions.

- 🗺️ **Interactive Map**  
  Leaflet with OpenStreetMap is integrated to provide location and map visualization.

- 💳 **Order & Payment Flow**  
  The platform demonstrates advance-payment and order-management flows.

- 🌐 **Multilingual Support**  
  The platform supports multiple Indian languages for easier access by farmers.

## 🔄 How It Works

Farmer  
↓  
List Produce + Upload/Capture Image  
↓  
AI-Assisted Quality Assessment  
↓  
KisanDirect Marketplace  
↓  
Buyer Requirement  
↓  
Smart Farmer-Buyer Matching  
↓  
Order Confirmation  
↓  
Shared / Coordinated Transport  
↓  
Buyer

## 🏗️ Prototype

The current prototype demonstrates the core **farmer and buyer marketplace experience**.

### Currently Implemented

- Farmer and Buyer interfaces
- Crop listing and image upload
- Gemini Vision API for AI-assisted crop quality assessment
- Supabase Storage for storing uploaded crop images
- Leaflet + OpenStreetMap for interactive map and location visualization
- Buyer requirements and farmer-buyer matching flow
- Mandi price interface
- Order and payment simulation
- Multilingual interface

### Planned Integrations

- FastAPI backend
- Supabase PostgreSQL database
- Real-time mandi price APIs
- Route optimization
- Payment gateway integration
- Third-party transport provider integration
- Notification services

## 🎯 Vision

> **To make agricultural trade more direct, transparent, and efficient by connecting farmers with the right buyers and enabling smarter logistics.**

## 🛠️ Technology Stack

### Current Prototype

- **React** – Frontend framework
- **Vite** – Development and build tool
- **Tailwind CSS** – Responsive UI styling
- **Gemini Vision API** – AI-assisted crop quality assessment
- **Supabase Storage** – Storage of uploaded crop images
- **Leaflet** – Interactive map integration
- **OpenStreetMap** – Map data and visualization
- **Local Storage** – Frontend state and demo data persistence

### Planned Backend & Integrations

- **Python + FastAPI** – Backend APIs and business logic
- **Supabase PostgreSQL** – Application database
- **Mandi Price APIs** – Real-time/updated mandi prices
- **Route Optimization Services** – Logistics planning
- **Payment Gateway** – Real payment processing
- **Third-Party Transport Providers** – Transportation coordination
- **Notification Services** – Order and delivery notifications

## 👥 Team

**Team InnoVentures**

Built for **Smart India Hackathon 2026**

**Problem Statement:**  
**26033 – Multiple intermediaries reduce farmers' earnings and increase consumer prices.**
