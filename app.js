// ============================================================================
// Financial Scenario Simulator
// A prompt-driven financial planning tool with D3.js visualization
// ============================================================================

// ============================================================================
// TAX CALCULATIONS (Ported from Future Planning.ipynb)
// 2026 Federal, NY State, and Payroll Tax Tables
// ============================================================================

const TAX_CONFIG = {
    federal: {
        single: [
            { rate: 0.10, min: 0, max: 12150 },
            { rate: 0.12, min: 12150, max: 49475 },
            { rate: 0.22, min: 49475, max: 105250 },
            { rate: 0.24, min: 105250, max: 200950 },
            { rate: 0.32, min: 200950, max: 255475 },
            { rate: 0.35, min: 255475, max: 639000 },
            { rate: 0.37, min: 639000, max: Infinity }
        ],
        married_jointly: [
            { rate: 0.10, min: 0, max: 24300 },
            { rate: 0.12, min: 24300, max: 98950 },
            { rate: 0.22, min: 98950, max: 210500 },
            { rate: 0.24, min: 210500, max: 401900 },
            { rate: 0.32, min: 401900, max: 510950 },
            { rate: 0.35, min: 510950, max: 765600 },
            { rate: 0.37, min: 765600, max: Infinity }
        ]
    },
    nyState: {
        single: [
            { rate: 0.04, min: 0, max: 8500 },
            { rate: 0.045, min: 8500, max: 11700 },
            { rate: 0.0525, min: 11700, max: 13900 },
            { rate: 0.055, min: 13900, max: 80650 },
            { rate: 0.06, min: 80650, max: 215400 },
            { rate: 0.0685, min: 215400, max: 1077550 },
            { rate: 0.0965, min: 1077550, max: 5000000 },
            { rate: 0.103, min: 5000000, max: 25000000 },
            { rate: 0.109, min: 25000000, max: Infinity }
        ],
        married_jointly: [
            { rate: 0.04, min: 0, max: 17150 },
            { rate: 0.045, min: 17150, max: 23600 },
            { rate: 0.0525, min: 23600, max: 27900 },
            { rate: 0.055, min: 27900, max: 161550 },
            { rate: 0.06, min: 161550, max: 323200 },
            { rate: 0.0685, min: 323200, max: 2155350 },
            { rate: 0.0965, min: 2155350, max: 5000000 },
            { rate: 0.103, min: 5000000, max: 25000000 },
            { rate: 0.109, min: 25000000, max: Infinity }
        ]
    },
    ltcg: {
        single: [
            { rate: 0.00, min: 0, max: 48350 },
            { rate: 0.15, min: 48350, max: 533400 },
            { rate: 0.20, min: 533400, max: Infinity }
        ],
        married_jointly: [
            { rate: 0.00, min: 0, max: 96700 },
            { rate: 0.15, min: 96700, max: 600050 },
            { rate: 0.20, min: 600050, max: Infinity }
        ]
    },
    standardDeduction: {
        single: 15300,
        married_jointly: 30600
    },
    fica: {
        socialSecurityRate: 0.062,
        socialSecurityWageBase: 170000,
        medicareRate: 0.0145,
        medicareSurtaxRate: 0.009,
        medicareSurtaxThreshold: {
            single: 200000,
            married_jointly: 250000
        }
    },
    charitableLimits: {
        cash: 0.60,
        appreciatedSecurities: 0.30
    }
};

function calculateProgressiveTax(taxableIncome, brackets) {
    if (taxableIncome <= 0) return 0;
    let totalTax = 0;
    for (const bracket of brackets) {
        if (taxableIncome <= bracket.min) break;
        const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
        totalTax += taxableInBracket * bracket.rate;
    }
    return totalTax;
}

function calculateFederalTax(taxableIncome, filingStatus = 'single') {
    const brackets = TAX_CONFIG.federal[filingStatus] || TAX_CONFIG.federal.single;
    return calculateProgressiveTax(taxableIncome, brackets);
}

function calculateNYTax(taxableIncome, filingStatus = 'single') {
    const brackets = TAX_CONFIG.nyState[filingStatus] || TAX_CONFIG.nyState.single;
    return calculateProgressiveTax(taxableIncome, brackets);
}

function calculateFICA(wageIncome, filingStatus = 'single') {
    const ssTaxable = Math.min(wageIncome, TAX_CONFIG.fica.socialSecurityWageBase);
    const ssTax = ssTaxable * TAX_CONFIG.fica.socialSecurityRate;
    const medicareBase = wageIncome * TAX_CONFIG.fica.medicareRate;
    const surtaxThreshold = TAX_CONFIG.fica.medicareSurtaxThreshold[filingStatus] || 200000;
    const medicareSurtax = Math.max(0, wageIncome - surtaxThreshold) * TAX_CONFIG.fica.medicareSurtaxRate;
    return {
        socialSecurity: ssTax,
        medicareBase: medicareBase,
        medicareSurtax: medicareSurtax,
        total: ssTax + medicareBase + medicareSurtax
    };
}

function calculateCapitalGainsTax(appreciation, ordinaryIncome, filingStatus = 'single') {
    if (appreciation <= 0) return 0;
    const brackets = TAX_CONFIG.ltcg[filingStatus] || TAX_CONFIG.ltcg.single;
    let totalTax = 0;
    let gainsRemaining = appreciation;
    let currentPosition = ordinaryIncome;
    
    for (const bracket of brackets) {
        if (gainsRemaining <= 0) break;
        if (currentPosition >= bracket.max) continue;
        const startInBracket = Math.max(currentPosition, bracket.min);
        const roomInBracket = bracket.max - startInBracket;
        const gainsInBracket = Math.min(gainsRemaining, roomInBracket);
        totalTax += gainsInBracket * bracket.rate;
        gainsRemaining -= gainsInBracket;
        currentPosition += gainsInBracket;
    }
    
    // Add NY capital gains (taxed as ordinary income)
    const nyGainsTax = calculateNYTax(ordinaryIncome + appreciation, filingStatus) - 
                       calculateNYTax(ordinaryIncome, filingStatus);
    
    return totalTax + nyGainsTax;
}

// ============================================================================
// MORTGAGE CALCULATOR
// ============================================================================

function calculateMortgagePayment(principal, annualRate, years) {
    if (principal <= 0 || annualRate <= 0) return 0;
    const monthlyRate = annualRate / 12;
    const nPayments = years * 12;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / 
           (Math.pow(1 + monthlyRate, nPayments) - 1);
}

function simulateMortgageYear(balance, annualRate, monthlyPayment, monthlyOverpayment = 0) {
    if (balance <= 0) return { newBalance: 0, principalPaid: 0, interestPaid: 0, totalPaid: 0 };
    
    const monthlyRate = annualRate / 12;
    let principalPaid = 0;
    let interestPaid = 0;
    let totalPaid = 0;
    
    for (let month = 0; month < 12; month++) {
        if (balance <= 0) break;
        const interest = balance * monthlyRate;
        const scheduledPrincipal = Math.min(monthlyPayment - interest, balance);
        const overpayPrincipal = Math.min(monthlyOverpayment, Math.max(0, balance - scheduledPrincipal));
        const actualPrincipal = scheduledPrincipal + overpayPrincipal;
        const payment = interest + actualPrincipal;
        balance -= actualPrincipal;
        principalPaid += actualPrincipal;
        interestPaid += interest;
        totalPaid += payment;
    }
    
    return {
        newBalance: Math.max(0, balance),
        principalPaid,
        interestPaid,
        totalPaid
    };
}

// ============================================================================
// DAF (DONOR ADVISED FUND) LOT TRACKING - FIFO Strategy
// ============================================================================

class ContributionLot {
    constructor(yearContributed, principal, currentValue = null) {
        this.yearContributed = yearContributed;
        this.principal = principal;
        this.currentValue = currentValue !== null ? currentValue : principal;
    }
    
    get appreciation() {
        return this.currentValue - this.principal;
    }
    
    get appreciationRatio() {
        return this.currentValue > 0 ? this.appreciation / this.currentValue : 0;
    }
    
    grow(annualRate) {
        this.currentValue *= (1 + annualRate);
    }
    
    clone() {
        return new ContributionLot(this.yearContributed, this.principal, this.currentValue);
    }
}

class DAFAccount {
    constructor() {
        this.lots = [];
    }
    
    addContribution(year, amount) {
        if (amount > 0) {
            this.lots.push(new ContributionLot(year, amount));
        }
    }
    
    applyGrowth(annualRate, currentYear) {
        for (const lot of this.lots) {
            // New contributions get half-year growth
            if (lot.yearContributed === currentYear) {
                lot.grow(annualRate * 0.5);
            } else {
                lot.grow(annualRate);
            }
        }
    }
    
    getTotalValue() {
        return this.lots.reduce((sum, lot) => sum + lot.currentValue, 0);
    }
    
    getTotalPrincipal() {
        return this.lots.reduce((sum, lot) => sum + lot.principal, 0);
    }
    
    getTotalAppreciation() {
        return this.lots.reduce((sum, lot) => sum + lot.appreciation, 0);
    }
    
    // FIFO donation: oldest lots first (most appreciated)
    donate(targetAmount) {
        // Sort by year (oldest first)
        this.lots.sort((a, b) => a.yearContributed - b.yearContributed);
        
        let donatedFMV = 0;
        let donatedPrincipal = 0;
        let donatedAppreciation = 0;
        let remaining = targetAmount;
        const lotsToRemove = [];
        
        for (let i = 0; i < this.lots.length && remaining > 0; i++) {
            const lot = this.lots[i];
            
            if (lot.currentValue <= remaining) {
                // Donate entire lot
                donatedFMV += lot.currentValue;
                donatedPrincipal += lot.principal;
                donatedAppreciation += lot.appreciation;
                remaining -= lot.currentValue;
                lotsToRemove.push(i);
            } else {
                // Partial lot donation (proportional split)
                const fraction = remaining / lot.currentValue;
                const donatedValue = remaining;
                const donatedPrinc = lot.principal * fraction;
                const donatedApprec = lot.appreciation * fraction;
                
                donatedFMV += donatedValue;
                donatedPrincipal += donatedPrinc;
                donatedAppreciation += donatedApprec;
                
                // Reduce the lot
                lot.principal -= donatedPrinc;
                lot.currentValue -= donatedValue;
                remaining = 0;
            }
        }
        
        // Remove fully donated lots (in reverse order to maintain indices)
        for (let i = lotsToRemove.length - 1; i >= 0; i--) {
            this.lots.splice(lotsToRemove[i], 1);
        }
        
        return {
            fmv: donatedFMV,
            principal: donatedPrincipal,
            appreciation: donatedAppreciation
        };
    }
    
    clone() {
        const newDaf = new DAFAccount();
        newDaf.lots = this.lots.map(lot => lot.clone());
        return newDaf;
    }
}

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

class SimulationEngine {
    constructor(scenario) {
        this.scenario = scenario;
        this.filingStatus = scenario.filingStatus || 'single';
    }
    
    run(horizonYears = 40) {
        const results = [];
        const startYear = 2026;
        
        // Initialize state from scenario
        let primaryIncome = this.scenario.income.startingIncome || 0;
        const incomeGrowth = (this.scenario.income.growthRate || 0) / 100;
        const yearsUntilRetirement = this.scenario.income.yearsUntilRetirement || 30;
        const startingSavings = this.scenario.income.startingSavings || 0;
        
        // Secondary income
        const secondaryIncome = this.scenario.income.secondaryIncome || [];
        
        // Deductions (as percentages)
        const rentPct = (this.scenario.deductions.rentPercent || 0) / 100;
        const savingsPct = (this.scenario.deductions.savingsPercent || 0) / 100;
        
        // Charitable - mode determines behavior (off, annual cash gift, or DAF)
        const charityMode = this.scenario.charitable.mode || 'off';
        const annualGiftPct = (this.scenario.charitable.annualGiftPercent || 0) / 100;
        const charityContributionPct = (this.scenario.charitable.contributionPercent || 0) / 100;
        const charityGrowthRate = (this.scenario.charitable.growthRate || 8) / 100;
        const donationStartYear = this.scenario.charitable.donationStartYear || 0;
        const initialDonationPct = (this.scenario.charitable.initialDonationPercent || 2) / 100;
        const stableDonationPct = (this.scenario.charitable.stableDonationPercent || 5) / 100;
        const donationTransitionYears = this.scenario.charitable.donationTransitionYears || 5;
        const dafStartingPrincipal = this.scenario.charitable.startingPrincipal || 0;
        
        // Housing - now supports multiple homes
        const homesConfig = this.scenario.housing?.homes || [];
        
        // Initialize home state for each configured home
        const homes = homesConfig.map(config => ({
            config: {
                label: config.label || 'Home',
                purchaseYear: config.purchaseYear || 0,
                price: config.price || 0,
                downPaymentPct: (config.downPaymentPercent || 20) / 100,
                mortgageRate: (config.mortgageRate || 6.5) / 100,
                appreciationRate: (config.appreciationRate || 3) / 100,
                monthlyPrepayment: config.monthlyPrepayment || 0
            },
            isOwned: false,
            mortgageBalance: 0,
            value: 0,
            monthlyMortgage: 0
        }));
        
        // Asset drawdown - now percentage based
        const drawdownActive = this.scenario.drawdown.active || false;
        const drawdownStartYear = this.scenario.drawdown.startYear || 20;
        const drawdownInitialPct = (this.scenario.drawdown.initialPercent || 2) / 100;
        const drawdownStablePct = (this.scenario.drawdown.stablePercent || 4) / 100;
        const drawdownTransitionYears = this.scenario.drawdown.transitionYears || 5;
        
        // Large purchases
        const largePurchases = this.scenario.purchases || [];
        
        // Initialize assets - use startingSavings from income section
        let liquidAssets = startingSavings;
        let retirementAssets = this.scenario.initialAssets?.retirement || 0;
        
        // Initialize DAF with FIFO lot tracking (only for DAF mode)
        const dafAccount = new DAFAccount();
        if (charityMode === 'daf' && dafStartingPrincipal > 0) {
            dafAccount.addContribution(startYear - 1, dafStartingPrincipal);
        }
        
        // Track if user owns any home (for rent calculation)
        let ownsAnyHome = false;
        
        // Growth rates
        const liquidGrowthRate = 0.08;  // 8% default
        const retirementGrowthRate = 0.08;
        
        for (let y = 0; y < horizonYears; y++) {
            const year = startYear + y;
            
            // Check if retired from primary income
            const isRetired = y >= yearsUntilRetirement;
            
            // Apply income growth (after first year, only if not retired)
            if (y > 0 && !isRetired) {
                primaryIncome *= (1 + incomeGrowth);
            }
            
            // Calculate total income including secondary streams
            // Primary income stops at retirement
            let currentPrimaryIncome = isRetired ? 0 : primaryIncome;
            let totalSecondaryIncome = 0;
            
            for (const sec of secondaryIncome) {
                if (y >= (sec.startYear || 0)) {
                    const yearsActive = y - (sec.startYear || 0);
                    const secGrowth = (sec.growthRate || 0) / 100;
                    totalSecondaryIncome += (sec.amount || 0) * Math.pow(1 + secGrowth, yearsActive);
                }
            }
            
            let totalIncome = currentPrimaryIncome + totalSecondaryIncome;
            const hasSecondaryIncome = totalSecondaryIncome > 0;
            
            // Calculate drawdown amount (percentage of liquid assets)
            let drawdownAmount = 0;
            let drawdownRate = 0;
            if (drawdownActive && y >= drawdownStartYear) {
                const yearsIntoDrawdown = y - drawdownStartYear;
                if (yearsIntoDrawdown < drawdownTransitionYears) {
                    // Linear transition from initial to stable percentage
                    const progress = yearsIntoDrawdown / drawdownTransitionYears;
                    drawdownRate = drawdownInitialPct + (drawdownStablePct - drawdownInitialPct) * progress;
                } else {
                    drawdownRate = drawdownStablePct;
                }
                drawdownAmount = liquidAssets * drawdownRate;
            }
            
            // Total available cash (for deduction calculations)
            const totalAvailableCash = totalIncome + drawdownAmount;
            
            // Housing costs - handle all homes dynamically
            let housingCost = 0;
            let rentCost = 0;
            let totalMortgagePayment = 0;
            let totalPropertyTax = 0;
            let totalMortgageInterest = 0;
            let totalHomeValue = 0;
            let totalHomeEquity = 0;
            
            // Process each home
            for (const home of homes) {
                // Check if buying this home this year
                if (!home.isOwned && y === home.config.purchaseYear && home.config.price > 0) {
                    home.isOwned = true;
                    ownsAnyHome = true;
                    const downPayment = home.config.price * home.config.downPaymentPct;
                    home.mortgageBalance = home.config.price - downPayment;
                    home.value = home.config.price;
                    home.monthlyMortgage = calculateMortgagePayment(home.mortgageBalance, home.config.mortgageRate, 30);
                    
                    // Down payment comes from liquid assets
                    liquidAssets -= downPayment;
                }
                
                // Process owned homes
                if (home.isOwned) {
                    let mortgagePayment = 0;
                    let mortgageInterest = 0;
                    let prepaymentAmount = 0;
                    
                    // Mortgage payment (with optional prepayment)
                    if (home.mortgageBalance > 0) {
                        const totalMonthlyPayment = home.monthlyMortgage + home.config.monthlyPrepayment;
                        const mortgageResult = simulateMortgageYear(home.mortgageBalance, home.config.mortgageRate, totalMonthlyPayment);
                        home.mortgageBalance = mortgageResult.newBalance;
                        mortgagePayment = mortgageResult.totalPaid;
                        mortgageInterest = mortgageResult.interestPaid;
                        prepaymentAmount = home.config.monthlyPrepayment * 12;
                    }
                    
                    // Property tax (1.5% of home value)
                    const propertyTax = home.value * 0.015;
                    
                    // Home appreciation
                    home.value *= (1 + home.config.appreciationRate);
                    
                    // Accumulate totals
                    totalMortgagePayment += mortgagePayment;
                    totalPropertyTax += propertyTax;
                    totalMortgageInterest += mortgageInterest;
                    totalHomeValue += home.value;
                    totalHomeEquity += (home.value - home.mortgageBalance);
                    housingCost += mortgagePayment + propertyTax;
                }
            }
            
            // Update ownership status
            ownsAnyHome = homes.some(h => h.isOwned);
            
            // Rent if not owning any home
            if (!ownsAnyHome) {
                rentCost = totalIncome * rentPct;
                housingCost = rentCost;
            }
            
            // Savings
            const savingsAmount = totalIncome * savingsPct;
            
            // ============================================================
            // CHARITABLE: Handles off, annual cash gift, or DAF modes
            // ============================================================
            
            let charityContribution = 0;
            let donationRate = 0;
            let donation = { fmv: 0, principal: 0, appreciation: 0 };
            let dafValue = 0;
            let dafPrincipal = 0;
            let dafAppreciation = 0;
            let annualCashGift = 0;
            
            if (charityMode === 'annual') {
                // Annual cash gift mode: simple percentage of income donated directly
                annualCashGift = totalIncome * annualGiftPct;
                // For tax purposes, treat as a donation with no appreciation (cash)
                donation = { fmv: annualCashGift, principal: annualCashGift, appreciation: 0 };
            } else if (charityMode === 'daf') {
                // DAF mode: contribution to DAF and donation from DAF (FIFO)
                
                // Contribution: % of income goes INTO the DAF
                charityContribution = totalIncome * charityContributionPct;
                dafAccount.addContribution(year, charityContribution);
                
                // Apply growth to DAF
                dafAccount.applyGrowth(charityGrowthRate, year);
                
                // Donation: Calculate target based on donation schedule
                let targetDonation = 0;
                
                if (y >= donationStartYear) {
                    const yearsIntoDonation = y - donationStartYear;
                    if (yearsIntoDonation < donationTransitionYears) {
                        // Linear transition from initial to stable percentage
                        const progress = yearsIntoDonation / donationTransitionYears;
                        donationRate = initialDonationPct + (stableDonationPct - initialDonationPct) * progress;
                    } else {
                        donationRate = stableDonationPct;
                    }
                    // Donation is a percentage of the current DAF value
                    targetDonation = dafAccount.getTotalValue() * donationRate;
                }
                
                donation = dafAccount.donate(targetDonation);
                
                // DAF state after donation
                dafValue = dafAccount.getTotalValue();
                dafPrincipal = dafAccount.getTotalPrincipal();
                dafAppreciation = dafAccount.getTotalAppreciation();
            }
            // else: charityMode === 'off' - all values remain 0
            
            // Large purchases this year
            let purchasesThisYear = 0;
            for (const purchase of largePurchases) {
                if (purchase.year === y) {
                    purchasesThisYear += purchase.amount || 0;
                }
            }
            
            // Calculate taxes
            const stdDeduction = TAX_CONFIG.standardDeduction[this.filingStatus] || 15300;
            
            // Itemized deductions (all properties)
            const saltDeduction = ownsAnyHome ? Math.min(totalPropertyTax + 10000, 10000) : 0;
            const mortgageInterestDeduction = totalMortgageInterest;
            
            // Charitable deduction based on FMV of donation
            // Cash gifts: 60% AGI limit, Appreciated securities: 30% AGI limit
            const charitableAgiLimit = charityMode === 'annual' 
                ? totalIncome * TAX_CONFIG.charitableLimits.cash 
                : totalIncome * TAX_CONFIG.charitableLimits.appreciatedSecurities;
            const charityDeduction = Math.min(donation.fmv, charitableAgiLimit);
            
            const totalItemized = saltDeduction + mortgageInterestDeduction + charityDeduction;
            const deductionUsed = Math.max(stdDeduction, totalItemized);
            const taxableIncome = Math.max(0, totalIncome - deductionUsed);
            
            const federalTax = calculateFederalTax(taxableIncome, this.filingStatus);
            const nyTax = calculateNYTax(taxableIncome, this.filingStatus);
            const fica = calculateFICA(totalIncome, this.filingStatus);
            
            // Calculate capital gains tax on drawdown
            // Assume 60% of drawdown is long-term capital gains (conservative estimate for growth portfolio)
            const drawdownGainsRatio = 0.6;
            const drawdownGains = drawdownAmount * drawdownGainsRatio;
            const drawdownCapGainsTax = calculateCapitalGainsTax(drawdownGains, totalIncome, this.filingStatus);
            
            const totalTax = federalTax + nyTax + fica.total + drawdownCapGainsTax;
            
            // Gross income for charting purposes (includes drawdown)
            const grossIncomeWithDrawdown = totalIncome + drawdownAmount;
            
            // Calculate charitable tax savings
            // Only show tax benefit if there's income to deduct against
            // After retirement, only secondary income provides tax benefit
            let charitableTaxSavings = 0;
            let capitalGainsAvoided = 0;
            
            if (totalIncome > 0 && (!isRetired || hasSecondaryIncome)) {
                const baselineItemized = saltDeduction + mortgageInterestDeduction;
                const baselineDeduction = Math.max(stdDeduction, baselineItemized);
                const baselineTaxable = Math.max(0, totalIncome - baselineDeduction);
                const baselineFederal = calculateFederalTax(baselineTaxable, this.filingStatus);
                const baselineNY = calculateNYTax(baselineTaxable, this.filingStatus);
                charitableTaxSavings = (baselineFederal + baselineNY) - (federalTax + nyTax);
                
                // Capital gains avoided by donating appreciated securities
                capitalGainsAvoided = calculateCapitalGainsTax(donation.appreciation, totalIncome, this.filingStatus);
            }
            
            // Total charitable benefit
            const totalCharitableBenefit = charitableTaxSavings + capitalGainsAvoided;
            
            // Donation efficiency: benefit per dollar of principal donated
            const donationEfficiency = donation.principal > 0 ? 
                (totalCharitableBenefit / donation.principal) * 100 : 0;
            
            // Discretionary spending (large purchases come from liquid assets, not income)
            // Include either DAF contributions or annual cash gifts depending on mode
            const charitableOutflow = charityMode === 'annual' ? annualCashGift : charityContribution;
            const preCommitted = totalTax + housingCost + savingsAmount + charitableOutflow;
            const discretionaryAmount = totalAvailableCash - preCommitted;
            
            // Update liquid assets
            // Apply growth first
            liquidAssets *= (1 + liquidGrowthRate);
            retirementAssets *= (1 + retirementGrowthRate);
            
            // Add savings
            liquidAssets += savingsAmount;
            
            // Subtract drawdown
            liquidAssets -= drawdownAmount;
            
            // Subtract large purchases
            liquidAssets -= purchasesThisYear;
            
            // Calculate net worth (including all properties, but NOT charitable DAF)
            // DAF is excluded because it's restricted for charitable purposes
            // totalHomeEquity is already calculated in the homes loop
            const netWorth = liquidAssets + retirementAssets + totalHomeEquity;
            
            // Build homes snapshot for results
            const homesSnapshot = homes.map(h => ({
                label: h.config.label,
                isOwned: h.isOwned,
                value: h.value,
                equity: h.value - h.mortgageBalance,
                mortgageBalance: h.mortgageBalance
            }));
            
            results.push({
                year,
                yearIndex: y,
                income: grossIncomeWithDrawdown,  // For charts: includes drawdown
                wageIncome: totalIncome,          // Just W2/earned income
                primaryIncome: currentPrimaryIncome,
                secondaryIncome: totalSecondaryIncome,
                isRetired,
                drawdownAmount,
                drawdownRate: drawdownRate * 100,
                drawdownCapGainsTax,
                
                // Housing (all properties)
                housingCost,
                rentCost,
                totalMortgagePayment,
                totalPropertyTax,
                totalHomeValue,
                totalHomeEquity,
                ownsAnyHome,
                homes: homesSnapshot,
                numHomes: homes.filter(h => h.isOwned).length,
                
                // Savings
                savingsAmount,
                
                // Charitable - detailed
                charityMode,
                charityContribution,
                annualCashGift,
                charitableOutflow,
                donationFMV: donation.fmv,
                donationPrincipal: donation.principal,
                donationAppreciation: donation.appreciation,
                donationRate: donationRate * 100,
                dafValue,
                dafPrincipal,
                dafAppreciation,
                
                // Taxes
                federalTax,
                nyTax,
                ficaTax: fica.total,
                totalTax,
                charitableTaxSavings,
                capitalGainsAvoided,
                totalCharitableBenefit,
                donationEfficiency,
                
                // Spending
                discretionaryAmount,
                discretionaryMonthly: discretionaryAmount / 12,
                
                // Assets
                liquidAssets,
                retirementAssets,
                netWorth,
                
                // Large purchases
                purchasesThisYear
            });
        }
        
        return results;
    }
}

// ============================================================================
// PROMPT DEFINITIONS
// ============================================================================

const PROMPT_DEFINITIONS = [
    {
        id: 'income',
        title: 'Income & Growth',
        fields: [
            { 
                id: 'startingIncome', 
                label: 'Starting Annual Income', 
                type: 'currency', 
                default: 100000,
                placeholder: 'e.g., $100,000 - Your current W2 salary'
            },
            { 
                id: 'growthRate', 
                label: 'Annual Growth Rate', 
                type: 'percent', 
                default: 3, 
                min: 0, 
                max: 15,
                placeholder: 'Expected yearly salary increase'
            },
            { 
                id: 'yearsUntilRetirement', 
                label: 'Years Until Retirement', 
                type: 'number', 
                default: 30,
                min: 1,
                max: 50,
                placeholder: 'Primary income stops after this many years'
            },
            { 
                id: 'startingSavings', 
                label: 'Starting Liquid Savings', 
                type: 'currency', 
                default: 100000,
                placeholder: 'Current investment account balance'
            },
            { 
                id: 'secondaryIncome', 
                label: 'Secondary Income Streams', 
                type: 'array', 
                arrayType: 'secondaryIncome' 
            }
        ]
    },
    {
        id: 'deductions',
        title: 'Regular Deductions',
        fields: [
            { 
                id: 'rentPercent', 
                label: 'Rent Expense (% of income)', 
                type: 'percent', 
                default: 20, 
                min: 0, 
                max: 50,
                placeholder: 'Portion of income spent on rent'
            },
            { 
                id: 'savingsPercent', 
                label: 'Savings Rate (% of income)', 
                type: 'percent', 
                default: 15, 
                min: 0, 
                max: 50,
                placeholder: 'Portion going to liquid investments'
            }
        ]
    },
    {
        id: 'charitable',
        title: 'Charitable Giving',
        fields: [
            { 
                id: 'mode', 
                label: 'Giving Mode', 
                type: 'select', 
                default: 'off',
                options: [
                    { value: 'off', label: 'Off' },
                    { value: 'annual', label: 'Cash' },
                    { value: 'daf', label: 'DAF' }
                ]
            },
            // Annual gift fields
            { 
                id: 'annualGiftPercent', 
                label: 'Annual Gift (% of income)', 
                type: 'percent', 
                default: 5, 
                min: 0, 
                max: 60,
                condition: { field: 'mode', value: 'annual' },
                placeholder: 'Percentage of income donated as cash each year'
            },
            // DAF fields
            { 
                id: 'startingPrincipal', 
                label: 'Starting DAF Balance', 
                type: 'currency', 
                default: 0,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'Existing DAF balance at simulation start'
            },
            { 
                id: 'contributionPercent', 
                label: 'DAF Contribution (% of income)', 
                type: 'percent', 
                default: 5, 
                min: 0, 
                max: 30,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'Amount going INTO your Donor Advised Fund'
            },
            { 
                id: 'growthRate', 
                label: 'DAF Growth Rate', 
                type: 'percent', 
                default: 8, 
                min: 0, 
                max: 15,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'Expected investment growth inside DAF'
            },
            { 
                id: 'donationStartYear', 
                label: 'Start Donating (years after start)', 
                type: 'number', 
                default: 2, 
                min: 0, 
                max: 40,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'When to begin donating from DAF'
            },
            { 
                id: 'initialDonationPercent', 
                label: 'Initial Donation Rate (% of DAF)', 
                type: 'percent', 
                default: 2, 
                min: 0, 
                max: 20,
                step: 0.5,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'Starting % of DAF to donate annually'
            },
            { 
                id: 'stableDonationPercent', 
                label: 'Stable Donation Rate (% of DAF)', 
                type: 'percent', 
                default: 5, 
                min: 0, 
                max: 20,
                step: 0.5,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'Target annual donation rate'
            },
            { 
                id: 'donationTransitionYears', 
                label: 'Donation Transition Period (years)', 
                type: 'number', 
                default: 5, 
                min: 1, 
                max: 20,
                condition: { field: 'mode', value: 'daf' },
                placeholder: 'Years to reach stable donation rate'
            }
        ]
    },
    {
        id: 'housing',
        title: 'Home Purchases',
        fields: [
            { 
                id: 'homes', 
                label: 'Properties', 
                type: 'array', 
                arrayType: 'homes' 
            }
        ]
    },
    {
        id: 'drawdown',
        title: 'Liquid Asset Drawdown',
        fields: [
            { id: 'active', label: 'Enable Drawdown', type: 'toggle', default: false },
            { 
                id: 'startYear', 
                label: 'Start Year (after simulation start)', 
                type: 'number', 
                default: 20, 
                min: 1, 
                max: 40, 
                condition: 'active',
                placeholder: 'Year to begin withdrawals'
            },
            { 
                id: 'initialPercent', 
                label: 'Initial Withdrawal Rate (%)', 
                type: 'percent', 
                default: 2, 
                min: 0, 
                max: 10, 
                step: 0.5,
                condition: 'active',
                placeholder: 'Starting % of assets to withdraw'
            },
            { 
                id: 'stablePercent', 
                label: 'Stable Withdrawal Rate (%)', 
                type: 'percent', 
                default: 4, 
                min: 0, 
                max: 10, 
                step: 0.5,
                condition: 'active',
                placeholder: 'Target % (e.g., 4% rule)'
            },
            { 
                id: 'transitionYears', 
                label: 'Transition Period (years)', 
                type: 'number', 
                default: 5, 
                min: 1, 
                max: 15, 
                condition: 'active',
                placeholder: 'Years to reach stable rate'
            }
        ]
    },
    {
        id: 'purchases',
        title: 'Large Purchases',
        fields: [
            { id: 'purchases', label: 'One-Time Purchases', type: 'purchaseList' }
        ]
    }
];

// ============================================================================
// SCENARIO MANAGER
// ============================================================================

const SCENARIO_COLORS = [
    '#00d4ff', '#a855f7', '#00ff88', '#ff9500', '#ec4899', 
    '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#84cc16'
];

class ScenarioManager {
    constructor() {
        this.scenarios = [];
        this.activeScenarioId = null;
        this.nextId = 1;
    }
    
    createScenario(name = null, copyFrom = null) {
        const id = this.nextId++;
        const colorIndex = (this.scenarios.length) % SCENARIO_COLORS.length;
        
        const scenario = {
            id,
            name: name || `Scenario ${id}`,
            color: SCENARIO_COLORS[colorIndex],
            data: copyFrom ? JSON.parse(JSON.stringify(copyFrom.data)) : this.getDefaultData(),
            results: null
        };
        
        this.scenarios.push(scenario);
        this.activeScenarioId = id;
        return scenario;
    }
    
    getDefaultData() {
        return {
            filingStatus: 'single',
            income: {
                startingIncome: 100000,
                growthRate: 3,
                yearsUntilRetirement: 30,
                startingSavings: 100000,
                secondaryIncome: []
            },
            deductions: {
                rentPercent: 20,
                savingsPercent: 15
            },
            charitable: {
                mode: 'off',
                annualGiftPercent: 5,
                startingPrincipal: 0,
                contributionPercent: 5,
                growthRate: 8,
                donationStartYear: 2,
                initialDonationPercent: 2,
                stableDonationPercent: 5,
                donationTransitionYears: 5
            },
            housing: {
                homes: []
            },
            drawdown: {
                active: false,
                startYear: 20,
                initialPercent: 2,
                stablePercent: 4,
                transitionYears: 5
            },
            purchases: [],
            initialAssets: {
                retirement: 50000,
                charitable: 0
            }
        };
    }
    
    getActiveScenario() {
        return this.scenarios.find(s => s.id === this.activeScenarioId);
    }
    
    setActiveScenario(id) {
        this.activeScenarioId = id;
    }
    
    deleteScenario(id) {
        const index = this.scenarios.findIndex(s => s.id === id);
        if (index !== -1 && this.scenarios.length > 1) {
            this.scenarios.splice(index, 1);
            if (this.activeScenarioId === id) {
                this.activeScenarioId = this.scenarios[0].id;
            }
        }
    }
    
    runSimulation(scenario) {
        const engine = new SimulationEngine(scenario.data);
        scenario.results = engine.run(40);
        return scenario.results;
    }
    
    runAllSimulations() {
        for (const scenario of this.scenarios) {
            this.runSimulation(scenario);
        }
    }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

class PromptUI {
    constructor(container, scenarioManager, onUpdate) {
        this.container = container;
        this.scenarioManager = scenarioManager;
        this.onUpdate = onUpdate;
        this.expandedPrompts = new Set(['income']);
    }
    
    render() {
        const scenario = this.scenarioManager.getActiveScenario();
        if (!scenario) return;
        
        this.container.innerHTML = '';
        
        for (const promptDef of PROMPT_DEFINITIONS) {
            const card = this.createPromptCard(promptDef, scenario);
            this.container.appendChild(card);
        }
    }
    
    createPromptCard(promptDef, scenario) {
        const card = document.createElement('div');
        card.className = `prompt-card${this.expandedPrompts.has(promptDef.id) ? ' expanded' : ''}`;
        
        const header = document.createElement('div');
        header.className = 'prompt-header';
        header.innerHTML = `
            <div class="prompt-title">
                <h3>${promptDef.title}</h3>
            </div>
            <span class="prompt-chevron">▼</span>
        `;
        header.onclick = () => {
            if (this.expandedPrompts.has(promptDef.id)) {
                this.expandedPrompts.delete(promptDef.id);
            } else {
                this.expandedPrompts.add(promptDef.id);
            }
            this.render();
        };
        
        const content = document.createElement('div');
        content.className = 'prompt-content';
        
        const data = scenario.data[promptDef.id] || {};
        
        for (const field of promptDef.fields) {
            // Check condition - supports both simple (boolean) and object-based conditions
            if (field.condition) {
                if (typeof field.condition === 'string') {
                    // Simple condition: check if the field is truthy
                    if (!data[field.condition]) continue;
                } else if (typeof field.condition === 'object') {
                    // Object condition: check if field matches specific value
                    if (data[field.condition.field] !== field.condition.value) continue;
                }
            }
            
            const group = this.createFormGroup(field, data, promptDef.id, scenario);
            if (group) content.appendChild(group);
        }
        
        card.appendChild(header);
        card.appendChild(content);
        return card;
    }
    
    createFormGroup(field, data, promptId, scenario) {
        const group = document.createElement('div');
        group.className = 'form-group';
        
        const placeholderText = field.placeholder || '';
        
        if (field.type === 'currency') {
            const value = data[field.id] ?? field.default;
            group.innerHTML = `
                <label class="form-label">${field.label}</label>
                <input type="text" class="form-input" 
                    value="${value ? this.formatCurrency(value) : ''}"
                    placeholder="${placeholderText}"
                    data-prompt="${promptId}" data-field="${field.id}" data-type="currency">
            `;
            const input = group.querySelector('input');
            input.addEventListener('change', (e) => this.handleInputChange(e, scenario));
            input.addEventListener('focus', (e) => {
                const val = data[field.id] ?? field.default;
                e.target.value = val ? val.toString() : '';
            });
            input.addEventListener('blur', (e) => {
                const val = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                e.target.value = val ? this.formatCurrency(val) : '';
            });
        } else if (field.type === 'percent') {
            const value = data[field.id] ?? field.default;
            group.innerHTML = `
                <label class="form-label">${field.label}</label>
                <div class="slider-container">
                    <input type="range" class="slider" 
                        min="${field.min ?? 0}" max="${field.max ?? 100}" 
                        step="${field.step ?? 1}" value="${value}"
                        data-prompt="${promptId}" data-field="${field.id}" data-type="percent">
                    <span class="slider-value">${value}%</span>
                </div>
                ${placeholderText ? `<div class="field-hint">${placeholderText}</div>` : ''}
            `;
            const slider = group.querySelector('.slider');
            const valueSpan = group.querySelector('.slider-value');
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = `${e.target.value}%`;
            });
            slider.addEventListener('change', (e) => this.handleInputChange(e, scenario));
        } else if (field.type === 'number') {
            const value = data[field.id] ?? field.default;
            group.innerHTML = `
                <label class="form-label">${field.label}</label>
                <input type="number" class="form-input" 
                    min="${field.min ?? 0}" max="${field.max ?? 100}"
                    value="${value}"
                    placeholder="${placeholderText}"
                    data-prompt="${promptId}" data-field="${field.id}" data-type="number">
            `;
            const input = group.querySelector('input');
            input.addEventListener('change', (e) => this.handleInputChange(e, scenario));
        } else if (field.type === 'toggle') {
            const checked = data[field.id] ?? field.default;
            group.innerHTML = `
                <div class="toggle-container">
                    <div class="toggle${checked ? ' active' : ''}" 
                        data-prompt="${promptId}" data-field="${field.id}" data-type="toggle"></div>
                    <label class="form-label" style="margin-bottom: 0">${field.label}</label>
                </div>
            `;
            const toggle = group.querySelector('.toggle');
            toggle.addEventListener('click', (e) => {
                const isActive = toggle.classList.toggle('active');
                scenario.data[promptId][field.id] = isActive;
                this.onUpdate();
                this.render();
            });
        } else if (field.type === 'select') {
            const value = data[field.id] ?? field.default;
            const activeIndex = field.options.findIndex(opt => opt.value === value);
            const optionsHtml = field.options.map((opt, idx) => 
                `<div class="segmented-toggle-option${opt.value === value ? ' active' : ''}" data-value="${opt.value}" data-index="${idx}">${opt.label}</div>`
            ).join('');
            group.innerHTML = `
                <label class="form-label">${field.label}</label>
                <div class="segmented-toggle" data-prompt="${promptId}" data-field="${field.id}">
                    <div class="segmented-toggle-highlight"></div>
                    ${optionsHtml}
                </div>
            `;
            
            const toggle = group.querySelector('.segmented-toggle');
            const highlight = toggle.querySelector('.segmented-toggle-highlight');
            const options = toggle.querySelectorAll('.segmented-toggle-option');
            
            // Position the highlight on the active option
            const updateHighlight = () => {
                const activeOption = toggle.querySelector('.segmented-toggle-option.active');
                if (activeOption) {
                    highlight.style.left = activeOption.offsetLeft + 'px';
                    highlight.style.width = activeOption.offsetWidth + 'px';
                }
            };
            
            // Initial position (defer to allow DOM to render)
            requestAnimationFrame(updateHighlight);
            
            options.forEach(option => {
                option.addEventListener('click', () => {
                    const newValue = option.dataset.value;
                    options.forEach(o => o.classList.remove('active'));
                    option.classList.add('active');
                    updateHighlight();
                    scenario.data[promptId][field.id] = newValue;
                    this.onUpdate();
                    this.render();
                });
            });
        } else if (field.type === 'purchaseList') {
            const purchases = scenario.data.purchases || [];
            let html = '';
            
            for (let i = 0; i < purchases.length; i++) {
                const p = purchases[i];
                html += `
                    <div class="purchase-item" data-index="${i}">
                        <button class="purchase-remove" data-index="${i}">✕</button>
                        <input type="text" class="form-input" placeholder="Description (e.g., Wedding, Car)" 
                            value="${p.label || ''}" data-field="label" data-index="${i}">
                        <div class="purchase-row">
                            <div class="purchase-field">
                                <input type="number" class="form-input" placeholder="Year #" 
                                    value="${p.year ?? ''}" data-field="year" data-index="${i}" min="0" max="40">
                                <span class="field-hint">Year (0 = now)</span>
                            </div>
                            <div class="purchase-field">
                                <input type="text" class="form-input" placeholder="$50,000" 
                                    value="${p.amount ? this.formatCurrency(p.amount) : ''}" data-field="amount" data-index="${i}">
                                <span class="field-hint">Cost</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `<button class="add-purchase-btn">+ Add Large Purchase</button>`;
            group.innerHTML = html;
            
            // Event listeners
            group.querySelectorAll('.purchase-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    scenario.data.purchases.splice(idx, 1);
                    this.onUpdate();
                    this.render();
                });
            });
            
            group.querySelectorAll('.purchase-item input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.index);
                    const field = e.target.dataset.field;
                    let value = e.target.value;
                    if (field === 'amount') {
                        value = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
                        e.target.value = value ? this.formatCurrency(value) : '';
                    } else if (field === 'year') {
                        value = parseInt(value) || 0;
                    }
                    scenario.data.purchases[idx][field] = value;
                    this.onUpdate();
                });
            });
            
            group.querySelector('.add-purchase-btn').addEventListener('click', () => {
                scenario.data.purchases.push({ label: '', year: 0, amount: 0 });
                this.onUpdate();
                this.render();
            });
        } else if (field.type === 'array' && field.arrayType === 'secondaryIncome') {
            const streams = data.secondaryIncome || [];
            let html = '';
            
            for (let i = 0; i < streams.length; i++) {
                const s = streams[i];
                html += `
                    <div class="purchase-item" data-index="${i}">
                        <button class="purchase-remove" data-sec-index="${i}">✕</button>
                        <div class="purchase-row">
                            <div class="purchase-field">
                                <input type="number" class="form-input" placeholder="5" 
                                    value="${s.startYear ?? ''}" data-sec-field="startYear" data-sec-index="${i}" min="0" max="40">
                                <span class="field-hint">Start Year</span>
                            </div>
                            <div class="purchase-field">
                                <input type="text" class="form-input" placeholder="$50,000" 
                                    value="${s.amount ? this.formatCurrency(s.amount) : ''}" data-sec-field="amount" data-sec-index="${i}">
                                <span class="field-hint">Annual Amount</span>
                            </div>
                        </div>
                        <div class="purchase-row" style="margin-top: 8px">
                            <div class="purchase-field" style="flex: 1">
                                <input type="number" class="form-input" placeholder="3" 
                                    value="${s.growthRate ?? ''}" data-sec-field="growthRate" data-sec-index="${i}" min="0" max="20">
                                <span class="field-hint">Annual Growth %</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `<button class="add-purchase-btn add-secondary-btn">+ Add Income Stream</button>`;
            group.innerHTML = `<label class="form-label">${field.label}</label>` + html;
            
            group.querySelectorAll('[data-sec-index].purchase-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.secIndex);
                    scenario.data.income.secondaryIncome.splice(idx, 1);
                    this.onUpdate();
                    this.render();
                });
            });
            
            group.querySelectorAll('[data-sec-field]').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.secIndex);
                    const field = e.target.dataset.secField;
                    let value = e.target.value;
                    if (field === 'amount') {
                        value = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
                        e.target.value = value ? this.formatCurrency(value) : '';
                    } else {
                        value = parseFloat(value) || 0;
                    }
                    scenario.data.income.secondaryIncome[idx][field] = value;
                    this.onUpdate();
                });
            });
            
            group.querySelector('.add-secondary-btn').addEventListener('click', () => {
                if (!scenario.data.income.secondaryIncome) {
                    scenario.data.income.secondaryIncome = [];
                }
                scenario.data.income.secondaryIncome.push({ startYear: 0, amount: 0, growthRate: 0 });
                this.onUpdate();
                this.render();
            });
        } else if (field.type === 'array' && field.arrayType === 'homes') {
            const homes = data.homes || [];
            let html = '';
            
            for (let i = 0; i < homes.length; i++) {
                const h = homes[i];
                html += `
                    <div class="purchase-item" data-home-index="${i}">
                        <button class="purchase-remove" data-home-remove="${i}">✕</button>
                        <div class="purchase-row">
                            <div class="purchase-field" style="flex: 2">
                                <input type="text" class="form-input" placeholder="Primary Residence" 
                                    value="${h.label || ''}" data-home-field="label" data-home-index="${i}">
                                <span class="field-hint">Property Name</span>
                            </div>
                            <div class="purchase-field">
                                <input type="number" class="form-input" placeholder="5" 
                                    value="${h.purchaseYear ?? ''}" data-home-field="purchaseYear" data-home-index="${i}" min="0" max="40">
                                <span class="field-hint">Year to Buy</span>
                            </div>
                        </div>
                        <div class="purchase-row" style="margin-top: 8px">
                            <div class="purchase-field" style="flex: 2">
                                <input type="text" class="form-input" placeholder="$800,000" 
                                    value="${h.price ? this.formatCurrency(h.price) : ''}" data-home-field="price" data-home-index="${i}">
                                <span class="field-hint">Purchase Price</span>
                            </div>
                            <div class="purchase-field">
                                <input type="number" class="form-input" placeholder="20" 
                                    value="${h.downPaymentPercent ?? 20}" data-home-field="downPaymentPercent" data-home-index="${i}" min="5" max="100">
                                <span class="field-hint">Down Payment %</span>
                            </div>
                        </div>
                        <div class="purchase-row" style="margin-top: 8px">
                            <div class="purchase-field">
                                <input type="number" class="form-input" placeholder="6.5" step="0.1"
                                    value="${h.mortgageRate ?? 6.5}" data-home-field="mortgageRate" data-home-index="${i}" min="2" max="12">
                                <span class="field-hint">Mortgage Rate %</span>
                            </div>
                            <div class="purchase-field">
                                <input type="number" class="form-input" placeholder="3" step="0.5"
                                    value="${h.appreciationRate ?? 3}" data-home-field="appreciationRate" data-home-index="${i}" min="0" max="10">
                                <span class="field-hint">Appreciation %</span>
                            </div>
                        </div>
                        <div class="purchase-row" style="margin-top: 8px">
                            <div class="purchase-field" style="flex: 1">
                                <input type="text" class="form-input" placeholder="$0" 
                                    value="${h.monthlyPrepayment ? this.formatCurrency(h.monthlyPrepayment) : ''}" data-home-field="monthlyPrepayment" data-home-index="${i}">
                                <span class="field-hint">Extra Principal/Month</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `<button class="add-purchase-btn add-home-btn">+ Add Property</button>`;
            group.innerHTML = `<label class="form-label">${field.label}</label>` + html;
            
            group.querySelectorAll('[data-home-remove]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.homeRemove);
                    scenario.data.housing.homes.splice(idx, 1);
                    this.onUpdate();
                    this.render();
                });
            });
            
            group.querySelectorAll('[data-home-field]').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.homeIndex);
                    const fieldName = e.target.dataset.homeField;
                    let value = e.target.value;
                    
                    if (fieldName === 'price' || fieldName === 'monthlyPrepayment') {
                        value = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
                        e.target.value = value ? this.formatCurrency(value) : '';
                    } else if (fieldName === 'label') {
                        // Keep as string
                    } else {
                        value = parseFloat(value) || 0;
                    }
                    
                    scenario.data.housing.homes[idx][fieldName] = value;
                    this.onUpdate();
                });
            });
            
            group.querySelector('.add-home-btn').addEventListener('click', () => {
                if (!scenario.data.housing.homes) {
                    scenario.data.housing.homes = [];
                }
                const homeNum = scenario.data.housing.homes.length + 1;
                scenario.data.housing.homes.push({ 
                    label: homeNum === 1 ? 'Primary Residence' : `Property ${homeNum}`,
                    purchaseYear: 5, 
                    price: 800000, 
                    downPaymentPercent: 20,
                    mortgageRate: 6.5,
                    appreciationRate: 3
                });
                this.onUpdate();
                this.render();
            });
        }
        
        return group;
    }
    
    handleInputChange(e, scenario) {
        const prompt = e.target.dataset.prompt;
        const field = e.target.dataset.field;
        const type = e.target.dataset.type;
        
        let value;
        if (type === 'currency') {
            value = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
        } else if (type === 'percent' || type === 'number') {
            value = parseFloat(e.target.value) || 0;
        }
        
        if (!scenario.data[prompt]) scenario.data[prompt] = {};
        scenario.data[prompt][field] = value;
        
        this.onUpdate();
    }
    
    formatCurrency(value) {
        return '$' + Math.round(value).toLocaleString();
    }
}

// ============================================================================
// CHART COMPONENTS
// ============================================================================

class ChartManager {
    constructor() {
        this.tooltip = document.getElementById('tooltip');
        this.charts = {};
        this.currentScenarios = [];
        this.animationDuration = 600; // ms for line draw animation
        
        // Spending chart line visibility state
        this.spendingLines = {
            grossIncome: { visible: true, label: 'Gross Income', color: '#00d4ff', key: 'income' },
            housing: { visible: true, label: 'Housing', color: '#f59e0b', key: 'housingCost' },
            contributions: { visible: true, label: 'Charitable Giving', color: '#ec4899', key: 'charitableOutflow' },
            donations: { visible: true, label: 'DAF Donations', color: '#a855f7', key: 'donationFMV' },
            taxes: { visible: true, label: 'Taxes', color: '#ef4444', key: 'totalTax' },
            discretionary: { visible: true, label: 'Discretionary (Monthly)', color: '#00ff88', key: 'discretionaryMonthly' }
        };
    }
    
    // Animate a line path drawing from left to right
    animateLine(path, duration = this.animationDuration) {
        const totalLength = path.node().getTotalLength();
        
        path
            .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .duration(duration)
            .ease(d3.easeQuadOut)
            .attr('stroke-dashoffset', 0);
    }
    
    // Animate dots appearing with delay based on position
    animateDots(dots, duration = this.animationDuration) {
        dots
            .attr('opacity', 0)
            .attr('r', 0)
            .transition()
            .duration(300)
            .delay((d, i, nodes) => (i / nodes.length) * duration)
            .attr('opacity', 0.7)
            .attr('r', 3);
    }
    
    renderAll(scenarios) {
        this.currentScenarios = scenarios;
        this.renderAssetChart(scenarios);
        this.renderTaxChart(scenarios);
        this.renderSpendingChart(scenarios);
    }
    
    renderAssetChart(scenarios) {
        const container = document.getElementById('asset-chart');
        const legend = document.getElementById('asset-legend');
        container.innerHTML = '';
        legend.innerHTML = '';
        
        if (!scenarios.length || !scenarios[0].results) {
            this.renderEmptyState(container, 'Configure your scenario to see projections');
            return;
        }
        
        const rect = container.getBoundingClientRect();
        const margin = { top: 20, right: 30, bottom: 40, left: 70 };
        const width = rect.width - margin.left - margin.right;
        const height = rect.height - margin.top - margin.bottom;
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Scales
        const allYears = scenarios[0].results.map(d => d.year);
        const xScale = d3.scaleLinear()
            .domain(d3.extent(allYears))
            .range([0, width]);
        
        // Find max value across all asset types
        let maxValue = 0;
        for (const scenario of scenarios) {
            if (scenario.results) {
                maxValue = Math.max(maxValue, d3.max(scenario.results, d => 
                    Math.max(d.liquidAssets, d.totalHomeEquity, d.dafValue, d.netWorth)
                ));
            }
        }
        
        const yScale = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([height, 0]);
        
        // Grid
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(''));
        
        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
        
        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatCompact(d)));
        
        // Asset type definitions
        const assetTypes = [
            { key: 'liquidAssets', label: 'Liquid Securities', color: '#00d4ff', dash: null },
            { key: 'totalHomeEquity', label: 'Home Equity', color: '#00ff88', dash: null },
            { key: 'dafValue', label: 'Charitable (DAF)', color: '#ec4899', dash: null },
            { key: 'netWorth', label: 'Net Worth', color: '#f59e0b', dash: '5,5' }
        ];
        
        // Draw lines for each scenario and asset type
        for (const scenario of scenarios) {
            if (!scenario.results) continue;
            
            for (const assetType of assetTypes) {
                const line = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(d[assetType.key]))
                    .curve(d3.curveMonotoneX);
                
                const path = g.append('path')
                    .datum(scenario.results)
                    .attr('class', 'line-path')
                    .attr('d', line)
                    .attr('stroke', scenarios.length > 1 ? scenario.color : assetType.color)
                    .attr('fill', 'none')
                    .attr('stroke-width', assetType.key === 'netWorth' ? 3 : 2)
                    .attr('opacity', assetType.key === 'netWorth' ? 1 : 0.8);
                
                // Animate the line (skip dashed lines as they use different dasharray)
                if (!assetType.dash) {
                    this.animateLine(path);
                } else {
                    // For dashed lines, fade in instead
                    path.attr('stroke-dasharray', assetType.dash)
                        .attr('opacity', 0)
                        .transition()
                        .duration(this.animationDuration)
                        .attr('opacity', assetType.key === 'netWorth' ? 1 : 0.8);
                }
                
                // Add visible dots at each data point
                const dotColor = scenarios.length > 1 ? scenario.color : assetType.color;
                const dots = g.selectAll(`.dot-${scenario.id}-${assetType.key}`)
                    .data(scenario.results)
                    .enter()
                    .append('circle')
                    .attr('cx', d => xScale(d.year))
                    .attr('cy', d => yScale(d[assetType.key]))
                    .attr('fill', dotColor)
                    .attr('stroke', 'var(--bg-card)')
                    .attr('stroke-width', 1)
                    .style('cursor', 'pointer')
                    .on('mouseover', (event, d) => {
                        d3.select(event.currentTarget)
                            .attr('r', 6)
                            .attr('opacity', 1);
                        this.showAssetTooltip(event, d, scenario, assetType);
                    })
                    .on('mouseout', (event) => {
                        d3.select(event.currentTarget)
                            .attr('r', 3)
                            .attr('opacity', 0.7);
                        this.hideTooltip();
                    })
                    .on('mousemove', (event) => this.moveTooltip(event));
                
                // Animate dots appearing
                this.animateDots(dots);
            }
            
            // Draw vertical lines for major purchases
            const purchases = scenario.data?.purchases || [];
            const startYear = 2026;
            
            for (const purchase of purchases) {
                if (purchase.year !== undefined && purchase.amount > 0) {
                    const purchaseYear = startYear + purchase.year;
                    const xPos = xScale(purchaseYear);
                    
                    // Only draw if within chart bounds
                    if (xPos >= 0 && xPos <= width) {
                        // Vertical dotted line
                        g.append('line')
                            .attr('x1', xPos)
                            .attr('y1', 0)
                            .attr('x2', xPos)
                            .attr('y2', height)
                            .attr('stroke', 'white')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4,4')
                            .attr('opacity', 0.6);
                        
                        // Purchase label
                        const label = purchase.label || 'Purchase';
                        g.append('text')
                            .attr('x', xPos)
                            .attr('y', -6)
                            .attr('text-anchor', 'middle')
                            .attr('fill', 'white')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .attr('opacity', 0.8)
                            .text(label);
                    }
                }
            }
            
            // Draw vertical lines for home purchases
            const homes = scenario.data?.housing?.homes || [];
            
            for (const home of homes) {
                if (home.purchaseYear !== undefined && home.price > 0) {
                    const homeYear = startYear + home.purchaseYear;
                    const xPos = xScale(homeYear);
                    
                    if (xPos >= 0 && xPos <= width) {
                        g.append('line')
                            .attr('x1', xPos)
                            .attr('y1', 0)
                            .attr('x2', xPos)
                            .attr('y2', height)
                            .attr('stroke', '#00ff88')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4,4')
                            .attr('opacity', 0.6);
                        
                        const label = home.label || 'Home';
                        g.append('text')
                            .attr('x', xPos)
                            .attr('y', -6)
                            .attr('text-anchor', 'middle')
                            .attr('fill', '#00ff88')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .attr('opacity', 0.8)
                            .text('🏠 ' + label);
                    }
                }
            }
        }
        
        // Legend
        if (scenarios.length === 1) {
            // Show asset type legend
            for (const assetType of assetTypes) {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-dot" style="background: ${assetType.color}"></div>
                    <span>${assetType.label}</span>
                `;
                legend.appendChild(item);
            }
        } else {
            // Show scenario legend
            for (const scenario of scenarios) {
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = `
                    <div class="legend-dot" style="background: ${scenario.color}"></div>
                    <span>${scenario.name}</span>
                `;
                legend.appendChild(item);
            }
        }
    }
    
    showAssetTooltip(event, d, scenario, assetType) {
        const appreciationPct = d.dafValue > 0 ? ((d.dafAppreciation / d.dafValue) * 100).toFixed(0) : 0;
        
        // Build home equity section
        let homeEquitySection = '';
        if (d.ownsAnyHome && d.homes && d.homes.length > 0) {
            homeEquitySection = `<div class="tooltip-row"><span class="tooltip-label">Home Equity (${d.numHomes} ${d.numHomes === 1 ? 'property' : 'properties'})</span><span class="tooltip-value" style="color: #00ff88">${this.formatCurrency(d.totalHomeEquity)}</span></div>`;
            
            // Show breakdown for each owned home
            for (const home of d.homes) {
                if (home.isOwned && home.equity > 0) {
                    homeEquitySection += `<div class="tooltip-row"><span class="tooltip-label" style="padding-left: 12px; font-size: 0.75rem;">└ ${home.label || 'Home'}</span><span class="tooltip-value" style="font-size: 0.75rem">${this.formatCurrency(home.equity)}</span></div>`;
                }
            }
        } else {
            homeEquitySection = `<div class="tooltip-row"><span class="tooltip-label">Home Equity</span><span class="tooltip-value" style="color: #00ff88">${this.formatCurrency(0)}</span></div>`;
        }
        
        const content = `
            <div class="tooltip-title" style="color: ${scenario.color}">${scenario.name} - ${d.year}</div>
            <div class="tooltip-row"><span class="tooltip-label">Net Worth</span><span class="tooltip-value" style="color: ${scenario.color}; font-weight: 600">${this.formatCurrency(d.netWorth)}</span></div>
            <hr style="border-color: var(--border-color); margin: 6px 0;">
            <div class="tooltip-row"><span class="tooltip-label">Liquid Securities</span><span class="tooltip-value" style="color: #00d4ff">${this.formatCurrency(d.liquidAssets)}</span></div>
            ${homeEquitySection}
            <hr style="border-color: var(--border-color); margin: 6px 0;">
            <div class="tooltip-row"><span class="tooltip-label">DAF (not in net worth)</span><span class="tooltip-value" style="color: #ec4899">${this.formatCurrency(d.dafValue)}</span></div>
            <div class="tooltip-row"><span class="tooltip-label" style="padding-left: 12px; font-size: 0.75rem;">└ ${appreciationPct}% appreciation</span><span class="tooltip-value" style="font-size: 0.75rem">${this.formatCurrency(d.dafAppreciation)}</span></div>
        `;
        
        this.tooltip.innerHTML = content;
        this.tooltip.classList.add('visible');
        this.moveTooltip(event);
    }
    
    renderTaxChart(scenarios) {
        const container = document.getElementById('tax-chart');
        const legend = document.getElementById('tax-legend');
        container.innerHTML = '';
        legend.innerHTML = '';
        
        if (!scenarios.length || !scenarios[0].results) {
            this.renderEmptyState(container, 'Tax breakdown will appear here');
            return;
        }
        
        const rect = container.getBoundingClientRect();
        const margin = { top: 20, right: 30, bottom: 40, left: 70 };
        const width = rect.width - margin.left - margin.right;
        const height = rect.height - margin.top - margin.bottom;
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const allYears = scenarios[0].results.map(d => d.year);
        const xScale = d3.scaleLinear()
            .domain(d3.extent(allYears))
            .range([0, width]);
        
        let maxTax = 0;
        for (const scenario of scenarios) {
            if (scenario.results) {
                maxTax = Math.max(maxTax, d3.max(scenario.results, d => d.totalTax));
            }
        }
        
        const yScale = d3.scaleLinear()
            .domain([0, maxTax * 1.1])
            .range([height, 0]);
        
        // Grid
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(''));
        
        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
        
        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatCompact(d)));
        
        // Tax line
        const taxLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.totalTax))
            .curve(d3.curveMonotoneX);
        
        // Charitable savings line
        const savingsLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.totalCharitableBenefit))
            .curve(d3.curveMonotoneX);
        
        // Capital gains avoided line
        const cgLine = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.capitalGainsAvoided))
            .curve(d3.curveMonotoneX);
        
        for (const scenario of scenarios) {
            if (!scenario.results) continue;
            
            // Tax line (animated)
            const taxPath = g.append('path')
                .datum(scenario.results)
                .attr('class', 'line-path')
                .attr('d', taxLine)
                .attr('stroke', scenario.color)
                .attr('fill', 'none')
                .attr('stroke-width', 2.5);
            this.animateLine(taxPath);
            
            // Total charitable benefit (dashed green - fade in)
            g.append('path')
                .datum(scenario.results)
                .attr('class', 'line-path')
                .attr('d', savingsLine)
                .attr('stroke', '#00ff88')
                .attr('fill', 'none')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .attr('opacity', 0)
                .transition()
                .duration(this.animationDuration)
                .attr('opacity', 0.8);
            
            // Capital gains avoided (dotted purple - fade in)
            g.append('path')
                .datum(scenario.results)
                .attr('class', 'line-path')
                .attr('d', cgLine)
                .attr('stroke', '#a855f7')
                .attr('fill', 'none')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '2,4')
                .attr('opacity', 0)
                .transition()
                .duration(this.animationDuration)
                .attr('opacity', 0.7);
            
            // Visible dots at each data point (animated)
            const taxDots = g.selectAll(`.tax-dot-${scenario.id}`)
                .data(scenario.results)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(d.year))
                .attr('cy', d => yScale(d.totalTax))
                .attr('fill', scenario.color)
                .attr('stroke', 'var(--bg-card)')
                .attr('stroke-width', 1)
                .style('cursor', 'pointer')
                .on('mouseover', (event, d) => {
                    d3.select(event.currentTarget)
                        .attr('r', 6)
                        .attr('opacity', 1);
                    this.showTooltip(event, d, scenario, 'tax');
                })
                .on('mouseout', (event) => {
                    d3.select(event.currentTarget)
                        .attr('r', 3)
                        .attr('opacity', 0.7);
                    this.hideTooltip();
                })
                .on('mousemove', (event) => this.moveTooltip(event));
            this.animateDots(taxDots);
            
            // Draw vertical lines for major purchases
            const purchases = scenario.data?.purchases || [];
            const startYear = 2026;
            
            for (const purchase of purchases) {
                if (purchase.year !== undefined && purchase.amount > 0) {
                    const purchaseYear = startYear + purchase.year;
                    const xPos = xScale(purchaseYear);
                    
                    if (xPos >= 0 && xPos <= width) {
                        g.append('line')
                            .attr('x1', xPos)
                            .attr('y1', 0)
                            .attr('x2', xPos)
                            .attr('y2', height)
                            .attr('stroke', 'white')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4,4')
                            .attr('opacity', 0.6);
                        
                        const label = purchase.label || 'Purchase';
                        g.append('text')
                            .attr('x', xPos)
                            .attr('y', -6)
                            .attr('text-anchor', 'middle')
                            .attr('fill', 'white')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .attr('opacity', 0.8)
                            .text(label);
                    }
                }
            }
            
            // Draw vertical lines for home purchases
            const homes = scenario.data?.housing?.homes || [];
            
            for (const home of homes) {
                if (home.purchaseYear !== undefined && home.price > 0) {
                    const homeYear = startYear + home.purchaseYear;
                    const xPos = xScale(homeYear);
                    
                    if (xPos >= 0 && xPos <= width) {
                        g.append('line')
                            .attr('x1', xPos)
                            .attr('y1', 0)
                            .attr('x2', xPos)
                            .attr('y2', height)
                            .attr('stroke', '#00ff88')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4,4')
                            .attr('opacity', 0.6);
                        
                        const label = home.label || 'Home';
                        g.append('text')
                            .attr('x', xPos)
                            .attr('y', -6)
                            .attr('text-anchor', 'middle')
                            .attr('fill', '#00ff88')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .attr('opacity', 0.8)
                            .text('🏠 ' + label);
                    }
                }
            }
        }
        
        // Legend
        legend.innerHTML = `
            <div class="legend-item">
                <div class="legend-dot" style="background: var(--accent-cyan)"></div>
                <span>Total Tax</span>
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background: #00ff88"></div>
                <span>Tax Savings</span>
            </div>
            <div class="legend-item">
                <div class="legend-dot" style="background: #a855f7"></div>
                <span>CG Avoided</span>
            </div>
        `;
    }
    
    renderSpendingChart(scenarios) {
        const container = document.getElementById('spending-chart');
        const legend = document.getElementById('spending-legend');
        container.innerHTML = '';
        legend.innerHTML = '';
        
        if (!scenarios.length || !scenarios[0].results) {
            this.renderEmptyState(container, 'Income & expense breakdown');
            return;
        }
        
        const rect = container.getBoundingClientRect();
        const margin = { top: 20, right: 30, bottom: 40, left: 70 };
        const width = rect.width - margin.left - margin.right;
        const height = rect.height - margin.top - margin.bottom;
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const allYears = scenarios[0].results.map(d => d.year);
        const xScale = d3.scaleLinear()
            .domain(d3.extent(allYears))
            .range([0, width]);
        
        // Calculate max/min based on VISIBLE lines only
        let maxValue = 0;
        let minValue = 0;
        for (const scenario of scenarios) {
            if (scenario.results) {
                for (const [lineId, lineConfig] of Object.entries(this.spendingLines)) {
                    if (lineConfig.visible) {
                        const lineMax = d3.max(scenario.results, d => d[lineConfig.key] || 0);
                        const lineMin = d3.min(scenario.results, d => d[lineConfig.key] || 0);
                        maxValue = Math.max(maxValue, lineMax);
                        minValue = Math.min(minValue, lineMin);
                    }
                }
            }
        }
        
        const yScale = d3.scaleLinear()
            .domain([Math.min(0, minValue * 1.1), maxValue * 1.1])
            .range([height, 0]);
        
        // Grid
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(''));
        
        // Zero line
        if (yScale.domain()[0] < 0) {
            g.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', yScale(0))
                .attr('y2', yScale(0))
                .attr('stroke', 'var(--text-muted)')
                .attr('stroke-dasharray', '4,4');
        }
        
        // Axes
        g.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')));
        
        g.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).tickFormat(d => this.formatCompact(d)));
        
        // Draw lines for each visible line type
        for (const scenario of scenarios) {
            if (!scenario.results) continue;
            
            for (const [lineId, lineConfig] of Object.entries(this.spendingLines)) {
                if (!lineConfig.visible) continue;
                
                const line = d3.line()
                    .x(d => xScale(d.year))
                    .y(d => yScale(d[lineConfig.key] || 0))
                    .curve(d3.curveMonotoneX);
                
                // Line path (animated)
                const linePath = g.append('path')
                    .datum(scenario.results)
                    .attr('class', `line-path line-${lineId}`)
                    .attr('d', line)
                    .attr('stroke', lineConfig.color)
                    .attr('fill', 'none')
                    .attr('stroke-width', lineId === 'discretionary' ? 3 : 2)
                    .attr('opacity', lineId === 'discretionary' ? 1 : 0.8);
                this.animateLine(linePath);
                
                // Dots for each data point (animated)
                const lineDots = g.selectAll(`.dot-${lineId}-${scenario.id}`)
                    .data(scenario.results)
                    .enter()
                    .append('circle')
                    .attr('class', `dot-${lineId}`)
                    .attr('cx', d => xScale(d.year))
                    .attr('cy', d => yScale(d[lineConfig.key] || 0))
                    .attr('fill', lineConfig.color)
                    .attr('stroke', 'var(--bg-card)')
                    .attr('stroke-width', 1)
                    .style('cursor', 'pointer')
                    .on('mouseover', (event, d) => {
                        d3.select(event.currentTarget)
                            .attr('r', 6)
                            .attr('opacity', 1);
                        this.showSpendingTooltip(event, d, scenario, lineId, lineConfig);
                    })
                    .on('mouseout', (event) => {
                        d3.select(event.currentTarget)
                            .attr('r', 3)
                            .attr('opacity', 0.7);
                        this.hideTooltip();
                    })
                    .on('mousemove', (event) => this.moveTooltip(event));
                this.animateDots(lineDots);
            }
            
            // Draw vertical lines for major purchases
            const purchases = scenario.data?.purchases || [];
            const startYear = 2026;
            
            for (const purchase of purchases) {
                if (purchase.year !== undefined && purchase.amount > 0) {
                    const purchaseYear = startYear + purchase.year;
                    const xPos = xScale(purchaseYear);
                    
                    if (xPos >= 0 && xPos <= width) {
                        g.append('line')
                            .attr('x1', xPos)
                            .attr('y1', 0)
                            .attr('x2', xPos)
                            .attr('y2', height)
                            .attr('stroke', 'white')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4,4')
                            .attr('opacity', 0.6);
                        
                        const label = purchase.label || 'Purchase';
                        g.append('text')
                            .attr('x', xPos)
                            .attr('y', -6)
                            .attr('text-anchor', 'middle')
                            .attr('fill', 'white')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .attr('opacity', 0.8)
                            .text(label);
                    }
                }
            }
            
            // Draw vertical lines for home purchases
            const homes = scenario.data?.housing?.homes || [];
            
            for (const home of homes) {
                if (home.purchaseYear !== undefined && home.price > 0) {
                    const homeYear = startYear + home.purchaseYear;
                    const xPos = xScale(homeYear);
                    
                    if (xPos >= 0 && xPos <= width) {
                        g.append('line')
                            .attr('x1', xPos)
                            .attr('y1', 0)
                            .attr('x2', xPos)
                            .attr('y2', height)
                            .attr('stroke', '#00ff88')
                            .attr('stroke-width', 1.5)
                            .attr('stroke-dasharray', '4,4')
                            .attr('opacity', 0.6);
                        
                        const label = home.label || 'Home';
                        g.append('text')
                            .attr('x', xPos)
                            .attr('y', -6)
                            .attr('text-anchor', 'middle')
                            .attr('fill', '#00ff88')
                            .attr('font-size', '10px')
                            .attr('font-weight', '500')
                            .attr('opacity', 0.8)
                            .text('🏠 ' + label);
                    }
                }
            }
        }
        
        // Interactive Legend
        for (const [lineId, lineConfig] of Object.entries(this.spendingLines)) {
            const item = document.createElement('div');
            item.className = `legend-item legend-toggle${lineConfig.visible ? '' : ' disabled'}`;
            item.style.cursor = 'pointer';
            item.style.opacity = lineConfig.visible ? '1' : '0.4';
            item.innerHTML = `
                <div class="legend-dot" style="background: ${lineConfig.color}${lineConfig.visible ? '' : '; opacity: 0.4'}"></div>
                <span style="${lineConfig.visible ? '' : 'text-decoration: line-through'}">${lineConfig.label}</span>
            `;
            
            item.addEventListener('click', () => {
                lineConfig.visible = !lineConfig.visible;
                this.renderSpendingChart(this.currentScenarios);
            });
            
            legend.appendChild(item);
        }
    }
    
    showSpendingTooltip(event, d, scenario, lineId, lineConfig) {
        const content = `
            <div class="tooltip-title" style="color: ${lineConfig.color}">${scenario.name} - ${d.year}</div>
            <div class="tooltip-row"><span class="tooltip-label">${lineConfig.label}</span><span class="tooltip-value" style="color: ${lineConfig.color}; font-weight: 600">${this.formatCurrency(d[lineConfig.key] || 0)}</span></div>
            <hr style="border-color: var(--border-color); margin: 6px 0;">
            <div class="tooltip-row"><span class="tooltip-label">Gross Income</span><span class="tooltip-value">${this.formatCurrency(d.income)}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Housing</span><span class="tooltip-value">${this.formatCurrency(d.housingCost)}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Taxes</span><span class="tooltip-value">${this.formatCurrency(d.totalTax)}</span></div>
            ${d.charityMode === 'annual' ? `<div class="tooltip-row"><span class="tooltip-label">Annual Gift</span><span class="tooltip-value">${this.formatCurrency(d.annualCashGift)}</span></div>` : ''}
            ${d.charityMode === 'daf' ? `<div class="tooltip-row"><span class="tooltip-label">DAF Contribution</span><span class="tooltip-value">${this.formatCurrency(d.charityContribution)}</span></div>` : ''}
            ${d.charityMode === 'daf' ? `<div class="tooltip-row"><span class="tooltip-label">DAF Donation</span><span class="tooltip-value">${this.formatCurrency(d.donationFMV)}</span></div>` : ''}
            <hr style="border-color: var(--border-color); margin: 6px 0;">
            <div class="tooltip-row"><span class="tooltip-label">Discretionary (Monthly)</span><span class="tooltip-value" style="color: #00ff88; font-weight: 600">${this.formatCurrency(d.discretionaryMonthly)}</span></div>
        `;
        
        this.tooltip.innerHTML = content;
        this.tooltip.classList.add('visible');
        this.moveTooltip(event);
    }
    
    showTooltip(event, d, scenario, type) {
        let content = `<div class="tooltip-title" style="color: ${scenario.color}">${scenario.name} - ${d.year}</div>`;
        
        if (type === 'asset') {
            content += `
                <div class="tooltip-row"><span class="tooltip-label">Net Worth</span><span class="tooltip-value" style="color: ${scenario.color}; font-weight: 600">${this.formatCurrency(d.netWorth)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Liquid Assets</span><span class="tooltip-value">${this.formatCurrency(d.liquidAssets)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Home Equity</span><span class="tooltip-value">${this.formatCurrency(d.totalHomeEquity)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">DAF Balance</span><span class="tooltip-value">${this.formatCurrency(d.dafValue)}</span></div>
            `;
        } else if (type === 'tax') {
            content += `
                <div class="tooltip-row"><span class="tooltip-label">Total Tax</span><span class="tooltip-value" style="color: ${scenario.color}; font-weight: 600">${this.formatCurrency(d.totalTax)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Federal</span><span class="tooltip-value">${this.formatCurrency(d.federalTax)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">NY State</span><span class="tooltip-value">${this.formatCurrency(d.nyTax)}</span></div>
                ${d.drawdownCapGainsTax > 0 ? `<div class="tooltip-row"><span class="tooltip-label">Drawdown Cap Gains</span><span class="tooltip-value">${this.formatCurrency(d.drawdownCapGainsTax)}</span></div>` : ''}
                <hr style="border-color: var(--border-color); margin: 6px 0;">
                ${d.charityMode === 'annual' ? `<div class="tooltip-row"><span class="tooltip-label">Annual Gift</span><span class="tooltip-value">${this.formatCurrency(d.annualCashGift)}</span></div>` : ''}
                ${d.charityMode === 'daf' ? `<div class="tooltip-row"><span class="tooltip-label">DAF Contribution</span><span class="tooltip-value">${this.formatCurrency(d.charityContribution)}</span></div>` : ''}
                ${d.charityMode === 'daf' ? `<div class="tooltip-row"><span class="tooltip-label">Donation (${d.donationRate.toFixed(1)}% of DAF)</span><span class="tooltip-value">${this.formatCurrency(d.donationFMV)}</span></div>` : ''}
                <div class="tooltip-row"><span class="tooltip-label">Tax Savings</span><span class="tooltip-value" style="color: #00ff88">${this.formatCurrency(d.charitableTaxSavings)}</span></div>
                ${d.charityMode === 'daf' ? `<div class="tooltip-row"><span class="tooltip-label">CG Avoided</span><span class="tooltip-value" style="color: #a855f7">${this.formatCurrency(d.capitalGainsAvoided)}</span></div>` : ''}
            `;
        } else if (type === 'spending') {
            content += `
                <div class="tooltip-row"><span class="tooltip-label">Monthly</span><span class="tooltip-value" style="color: ${scenario.color}; font-weight: 600">${this.formatCurrency(d.discretionaryMonthly)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Annual</span><span class="tooltip-value">${this.formatCurrency(d.discretionaryAmount)}</span></div>
                <div class="tooltip-row"><span class="tooltip-label">Gross Income</span><span class="tooltip-value">${this.formatCurrency(d.income)}</span></div>
                ${d.drawdownAmount > 0 ? `<div class="tooltip-row"><span class="tooltip-label" style="padding-left: 12px; font-size: 0.75rem;">└ Drawdown (${d.drawdownRate.toFixed(1)}%)</span><span class="tooltip-value" style="font-size: 0.75rem">${this.formatCurrency(d.drawdownAmount)}</span></div>` : ''}
                ${d.drawdownAmount > 0 ? `<div class="tooltip-row"><span class="tooltip-label" style="padding-left: 12px; font-size: 0.75rem;">└ Wage Income</span><span class="tooltip-value" style="font-size: 0.75rem">${this.formatCurrency(d.wageIncome)}</span></div>` : ''}
            `;
        }
        
        this.tooltip.innerHTML = content;
        this.tooltip.classList.add('visible');
        this.moveTooltip(event);
    }
    
    moveTooltip(event) {
        // Get the chart container to determine position relative to chart
        const chartContainer = event.target.closest('.chart-container');
        const tooltipWidth = this.tooltip.offsetWidth || 200;
        const tooltipHeight = this.tooltip.offsetHeight || 150;
        
        let x, y;
        
        // Use clientX/clientY for fixed positioning (viewport-relative)
        if (chartContainer) {
            const containerRect = chartContainer.getBoundingClientRect();
            const mouseXInContainer = event.clientX - containerRect.left;
            const containerMidpoint = containerRect.width / 2;
            
            // If past halfway, show tooltip to the left of cursor
            if (mouseXInContainer > containerMidpoint) {
                x = event.clientX - tooltipWidth - 15;
            } else {
                x = event.clientX + 15;
            }
        } else {
            // Fallback to right side
            x = event.clientX + 15;
        }
        
        y = event.clientY - 10;
        
        // Prevent tooltip from going off the bottom of the screen
        if (y + tooltipHeight > window.innerHeight) {
            y = window.innerHeight - tooltipHeight - 10;
        }
        
        // Prevent tooltip from going off the top
        if (y < 10) {
            y = 10;
        }
        
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }
    
    renderEmptyState(container, message) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h3>No Data Yet</h3>
                <p>${message}</p>
            </div>
        `;
    }
    
    formatCurrency(value) {
        return '$' + Math.round(value).toLocaleString();
    }
    
    formatCompact(value) {
        if (Math.abs(value) >= 1000000) {
            return '$' + (value / 1000000).toFixed(1) + 'M';
        } else if (Math.abs(value) >= 1000) {
            return '$' + (value / 1000).toFixed(0) + 'K';
        }
        return '$' + Math.round(value);
    }
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

class TabUI {
    constructor(container, scenarioManager, onSwitch, onAdd) {
        this.container = container;
        this.scenarioManager = scenarioManager;
        this.onSwitch = onSwitch;
        this.onAdd = onAdd;
    }
    
    render() {
        this.container.innerHTML = '';
        
        for (const scenario of this.scenarioManager.scenarios) {
            const tab = document.createElement('div');
            tab.className = `tab${scenario.id === this.scenarioManager.activeScenarioId ? ' active' : ''}`;
            tab.setAttribute('role', 'button');
            tab.setAttribute('tabindex', '0');
            
            const colorDot = document.createElement('span');
            colorDot.className = 'color-dot';
            colorDot.style.background = scenario.color;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'tab-name';
            nameSpan.textContent = scenario.name;
            
            tab.appendChild(colorDot);
            tab.appendChild(nameSpan);
            
            if (this.scenarioManager.scenarios.length > 1) {
                const closeBtn = document.createElement('span');
                closeBtn.className = 'tab-close';
                closeBtn.textContent = '✕';
                tab.appendChild(closeBtn);
            }
            
            // Track clicks for single vs double-click handling
            let clickTimeout = null;
            
            // Single click to switch tabs (with delay to allow double-click)
            tab.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-close')) {
                    this.scenarioManager.deleteScenario(scenario.id);
                    this.onSwitch();
                    return;
                }
                
                if (e.target.classList.contains('tab-name-input')) {
                    return;
                }
                
                // Check if clicking on the name span - delay to allow double-click
                if (e.target === nameSpan || e.target.classList.contains('tab-name')) {
                    if (clickTimeout) {
                        // Double-click detected - cancel single click and start rename
                        clearTimeout(clickTimeout);
                        clickTimeout = null;
                        this.startRename(tab, nameSpan, scenario);
                    } else {
                        // First click - wait to see if it's a double-click
                        clickTimeout = setTimeout(() => {
                            clickTimeout = null;
                            this.scenarioManager.setActiveScenario(scenario.id);
                            this.onSwitch();
                        }, 250);
                    }
                } else {
                    // Clicked on other parts of tab - immediate switch
                    this.scenarioManager.setActiveScenario(scenario.id);
                    this.onSwitch();
                }
            });
            
            this.container.appendChild(tab);
        }
        
        // Add button
        const addBtn = document.createElement('div');
        addBtn.className = 'tab-add';
        addBtn.textContent = '+';
        addBtn.title = 'New Scenario';
        addBtn.setAttribute('role', 'button');
        addBtn.setAttribute('tabindex', '0');
        addBtn.addEventListener('click', () => this.onAdd());
        this.container.appendChild(addBtn);
    }
    
    startRename(tab, nameSpan, scenario) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tab-name-input';
        input.value = scenario.name;
        input.style.cssText = `
            background: var(--bg-secondary);
            border: 1px solid var(--accent-cyan);
            color: var(--text-primary);
            font-size: inherit;
            font-family: inherit;
            padding: 2px 6px;
            border-radius: 4px;
            width: ${Math.max(60, scenario.name.length * 8)}px;
            outline: none;
        `;
        
        nameSpan.style.display = 'none';
        tab.insertBefore(input, nameSpan.nextSibling);
        input.focus();
        input.select();
        
        const finishRename = () => {
            const newName = input.value.trim() || scenario.name;
            scenario.name = newName;
            nameSpan.textContent = newName;
            nameSpan.style.display = '';
            input.remove();
            this.onSwitch(); // Re-render to update everywhere
        };
        
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = scenario.name; // Reset to original
                input.blur();
            }
            // Stop all key events from bubbling to prevent button behavior
            e.stopPropagation();
        });
        
        // Prevent spacebar and other keys from triggering button click
        input.addEventListener('keyup', (e) => e.stopPropagation());
        input.addEventListener('keypress', (e) => e.stopPropagation());
        
        // Prevent tab click from triggering while editing
        input.addEventListener('click', (e) => e.stopPropagation());
    }
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

class App {
    constructor() {
        this.scenarioManager = new ScenarioManager();
        this.chartManager = new ChartManager();
        
        // Create initial scenario
        this.scenarioManager.createScenario('Base Case');
        
        // Initialize UI components
        this.promptUI = new PromptUI(
            document.getElementById('prompts-container'),
            this.scenarioManager,
            () => this.onScenarioUpdate()
        );
        
        this.tabUI = new TabUI(
            document.getElementById('scenario-tabs'),
            this.scenarioManager,
            () => this.onTabSwitch(),
            () => this.onAddScenario()
        );
        
        // Copy scenario button
        document.getElementById('copy-scenario-btn').addEventListener('click', () => {
            const active = this.scenarioManager.getActiveScenario();
            if (active) {
                this.scenarioManager.createScenario(`${active.name} (Copy)`, active);
                this.onTabSwitch();
            }
        });
        
        // Initial render
        this.render();
        
        // Handle resize
        window.addEventListener('resize', () => this.renderCharts());
    }
    
    onScenarioUpdate() {
        this.scenarioManager.runAllSimulations();
        this.renderCharts();
    }
    
    onTabSwitch() {
        this.render();
    }
    
    onAddScenario() {
        this.scenarioManager.createScenario();
        this.render();
    }
    
    render() {
        this.tabUI.render();
        this.promptUI.render();
        this.scenarioManager.runAllSimulations();
        this.renderCharts();
    }
    
    renderCharts() {
        // Only render the active scenario on charts
        const activeScenario = this.scenarioManager.getActiveScenario();
        if (activeScenario) {
            this.chartManager.renderAll([activeScenario]);
        } else {
            this.chartManager.renderAll([]);
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
