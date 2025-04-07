import ReactDOMServer from 'react-dom/server';
import React from 'react';
import ProjectFinancialReport, { ProjectReportData, FinancialSummaryData } from '@/components/projects/ProjectFinancialReport';

// Define interfaces for clarity (adjust if ProjectData/Invoice are defined elsewhere)
interface ProjectLike {
  planned_budget?: number;
  actual_budget?: number;
  planned_revenue?: number;
  actual_revenue?: number;
  usn_tax?: number;
  nds_tax?: number;
}

interface InvoiceLike {
  amount?: number;
}

// New Calculation Function
export const calculateFinancialSummary = (
    projectData: ProjectLike,
    nonCancelledInvoices: InvoiceLike[]
): FinancialSummaryData => {
    const actualBudget = projectData.actual_budget ?? 0;
    const plannedBudget = projectData.planned_budget ?? 0;
    const actualRevenue = projectData.actual_revenue ?? 0;
    const plannedRevenue = projectData.planned_revenue ?? 0;
    const usnTaxAmount = projectData.usn_tax ?? 0;
    const ndsTaxAmount = projectData.nds_tax ?? 0;

    // Sum of non-cancelled invoice amounts
    const spentOnInvoices = nonCancelledInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

    // Calculate total spent including taxes
    const totalSpentWithTaxes = spentOnInvoices + usnTaxAmount + ndsTaxAmount;

    // Calculate remaining cost based on total spent including taxes
    const remainingCost = actualBudget - totalSpentWithTaxes;

    // Variances
    const budgetVariance = actualBudget - plannedBudget;
    const revenueVariance = actualRevenue - plannedRevenue;
    const budgetVariancePercent = plannedBudget !== 0 ? (budgetVariance / plannedBudget) * 100 : undefined;
    const revenueVariancePercent = plannedRevenue !== 0 ? (revenueVariance / plannedRevenue) * 100 : undefined;

    // Margins
    let plannedGrossMargin: number | undefined = undefined;
    if (plannedRevenue !== 0) {
        plannedGrossMargin = ((plannedRevenue - plannedBudget) / plannedRevenue) * 100;
    }
    let actualGrossMargin: number | undefined = undefined;
    if (actualRevenue !== 0) {
        actualGrossMargin = ((actualRevenue - actualBudget) / actualRevenue) * 100;
    }
    let marginVariancePercent: number | undefined = undefined;
    if (actualGrossMargin !== undefined && plannedGrossMargin !== undefined) {
        marginVariancePercent = actualGrossMargin - plannedGrossMargin;
    }

    // Profits
    const grossProfit = actualRevenue - actualBudget;
    const netProfitEstimate = grossProfit - usnTaxAmount - ndsTaxAmount;

    return {
        totalSpent: totalSpentWithTaxes,
        remainingCost: remainingCost,
        budgetVariance: budgetVariance,
        budgetVariancePercent: budgetVariancePercent,
        revenueVariance: revenueVariance,
        revenueVariancePercent: revenueVariancePercent,
        // Note: FinancialSummaryData currently expects plannedMargin/actualMargin
        // We are calculating Gross Margins here. Adjust FinancialSummaryData or map appropriately
        plannedMargin: plannedGrossMargin, // Mapping Gross Margin to plannedMargin for now
        actualMargin: actualGrossMargin,   // Mapping Gross Margin to actualMargin for now
        marginVariancePercent: marginVariancePercent,
        estimatedNetProfit: netProfitEstimate,
        // Add grossProfit if you want it explicitly in the summary data
        // grossProfit: grossProfit,
    };
};

export const generateAndDownloadHtmlReport = (
    reportData: ProjectReportData,
    projectId: string
) => {
    // 1. Render the React component to a static HTML string
    const reportHtmlString = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProjectFinancialReport, { data: reportData })
    );

    // 2. Construct the full HTML document
    // Note: Basic styles are inline in the component itself for now.
    // Including Tailwind would require more complex setup (e.g., inlining used styles).
    const fullHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Финансовый отчет по проекту ${reportData.project.name || projectId}</title>
            <style>
                /* Minimal reset and body styles - relies on component inline styles */
                body { margin: 0; padding: 0; font-family: sans-serif; }
            </style>
        </head>
        <body>
            ${reportHtmlString}
        </body>
        </html>
    `;

    // 3. Create a Blob
    const blob = new Blob([fullHtml], { type: 'text/html' });

    // 4. Create a temporary download link and trigger click
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial-report-project-${reportData.project.number || projectId}.html`;
    document.body.appendChild(link);
    link.click();

    // 5. Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}; 