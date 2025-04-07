import React, { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';

// --- Interfaces (Should match the structured data) ---
interface ClosingDocumentReportItem {
    id: string;
    fileName: string;
    uploadedAt: Timestamp;
    date?: Timestamp | null;
    fileURL?: string;
}

interface InvoiceReportItem {
    id: string;
    supplierName: string;
    amount?: number;
    status?: string;
    dueDate?: Timestamp | null;
    paidAt?: Timestamp | null; // Added for aging calculation
    fileURL?: string;
    closingDocuments: ClosingDocumentReportItem[];
}

// --- Added Financial Summary Interface ---
export interface FinancialSummaryData {
    totalSpent: number;
    remainingCost: number;
    plannedMargin?: number;
    actualMargin?: number;
    budgetVariance?: number;
    budgetVariancePercent?: number;
    revenueVariance?: number;
    revenueVariancePercent?: number;
    marginVariancePercent?: number;
    estimatedNetProfit?: number; // Added
}

export interface ProjectReportData { // Export this interface
    project: {
        id: string;
        name?: string;
        number?: string;
        customer?: string;
        planned_budget?: number;
        actual_budget?: number;
        planned_revenue?: number;
        actual_revenue?: number;
        status?: string; // Added project status
        duedate?: Timestamp; // Added project due date
        usn_tax?: number; // Added tax fields
        nds_tax?: number;
    };
    invoices: InvoiceReportItem[];
    financialSummary: FinancialSummaryData; // Changed to required
    invoiceSummary: { // Added invoice summary
        countByStatus: { [status: string]: number };
        overdueCount: number;
        pendingAmount: number; // Added pending amount
    };
}

interface ProjectFinancialReportProps {
    data: ProjectReportData;
}

// --- Helper Functions (Simplified for direct use) ---
const formatDate = (timestamp: Timestamp | Date | undefined | null): string => {
    if (!timestamp) return 'N/A';
    // Ensure it's a Date object before formatting
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
    // Check if date is valid after potential conversion
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (amount: number | undefined | null, fallback: string = 'N/A'): string => {
    if (amount === undefined || amount === null) return fallback;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(amount);
};

const formatPercentage = (value: number | undefined | null, fallback: string = 'N/A'): string => {
    if (value === undefined || value === null || !isFinite(value)) return fallback;
    // Assuming value is already in percentage points (e.g., 15 for 15%)
    return new Intl.NumberFormat('ru-RU', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
};

const translateStatus = (status: string | undefined): string => {
    const map: { [key: string]: string } = {
        planning: 'Планирование', // Added planning
        active: 'Активный', // Added active
        completed: 'Завершен', // Added completed
        on_hold: 'На паузе', // Added on_hold
        pending_payment: 'Ожидает оплаты',
        paid: 'Оплачен',
        overdue: 'Просрочен',
        cancelled: 'Отменен',
    };
    return status ? (map[status] || status) : 'N/A';
};

// --- Variance Color Helper ---
const getVarianceColor = (variance: number | undefined | null, positiveIsGood: boolean): string => {
    if (variance === undefined || variance === null || Math.abs(variance) < 0.01) return '#4b5563'; // gray-600 (neutral, handle near-zero)
    if (positiveIsGood) {
        return variance > 0 ? '#16a34a' : '#dc2626'; // green-600 : red-600
    } else {
        return variance < 0 ? '#16a34a' : '#dc2626'; // green-600 : red-600 (inverted for budget)
    }
};

// --- Budget Bar Helper ---
const BudgetProgressBar: React.FC<{ spent: number; budget: number | undefined }> = ({ spent, budget }) => {
    const actualBudget = budget ?? 0;
    // Calculate percentage, ensure it's between 0 and 100
    const percentage = actualBudget > 0 ? Math.max(0, Math.min((spent / actualBudget) * 100, 100)) : 0;
    const isOverBudget = actualBudget > 0 && spent > actualBudget;
    const barColor = isOverBudget ? '#dc2626' : '#22c55e'; // red-600 : green-500

    return (
        <div title={`Потрачено: ${formatCurrency(spent)} из ${formatCurrency(actualBudget)} (${percentage.toFixed(1)}%)`}
             style={{ height: '8px', backgroundColor: '#e5e7eb' /* gray-200 */, borderRadius: '4px', overflow: 'hidden', marginTop: '4px', border: isOverBudget ? '1px solid #dc2626' : 'none' }}>
            <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.5s ease-in-out' }}></div>
        </div>
    );
};

const ProjectFinancialReport: React.FC<ProjectFinancialReportProps> = ({ data }) => {
    // Memoize supplier spending calculation
    const supplierSpending = useMemo(() => {
        // If data or invoices are not available yet, return empty array
        if (!data?.invoices) return []; 
        const spending: { [name: string]: number } = {};
        data.invoices.forEach(invoice => {
            if (invoice.status !== 'cancelled' && invoice.amount && invoice.supplierName) {
                spending[invoice.supplierName] = (spending[invoice.supplierName] || 0) + invoice.amount;
            }
        });
        return Object.entries(spending).sort(([, a], [, b]) => b - a); // Sort descending by amount
    }, [data?.invoices]); // Depend on data.invoices

    // Ensure data exists before destructuring
    if (!data || !data.project || !data.financialSummary || !data.invoiceSummary) {
        return <div>Ошибка: Неполные данные для отчета.</div>; // Or a loading state/placeholder
    }
    const { project, invoices, financialSummary, invoiceSummary } = data;

    // --- Styles --- (Keep the object-based styles from previous step)
    const styles: { [key: string]: React.CSSProperties } = {
        body: { fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif", padding: '24px', backgroundColor: '#ffffff', color: '#1f2937' },
        h1: { fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 700, marginBottom: '1rem', color: '#111827' },
        h2: { fontSize: '1.25rem', lineHeight: '1.75rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' },
        section: { marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem 1rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
        gridItem: { display: 'flex', justifyContent: 'space-between' }, // Use flex for label/value alignment
        label: { fontWeight: 500, color: '#4b5563', marginRight: '0.5rem' }, // Medium weight for labels
        value: { color: '#1f2937', textAlign: 'right' }, // Align values right
        table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', lineHeight: '1.25rem', marginBottom: '1rem' },
        th: { backgroundColor: '#f3f4f6', textAlign: 'left', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', fontWeight: 600 }, // Added more padding
        td: { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', verticalAlign: 'top' }, // Added more padding
        ul: { listStyle: 'none', paddingLeft: 0, margin: '0.25rem 0', fontSize: '0.75rem', lineHeight: '1rem' }, // Remove list style for docs
        li: { marginBottom: '0.125rem' },
        footer: { fontSize: '0.75rem', lineHeight: '1rem', color: '#9ca3af', marginTop: '2rem', textAlign: 'center' },
        link: { color: '#2563eb', textDecoration: 'underline' },
        noDataSpan: { color: '#9ca3af' },
    };

    const summaryStyles: { [key: string]: React.CSSProperties } = {
        summaryContainer: { marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' },
        sectionTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }, // Slightly larger title
        metricGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontSize: '0.875rem', lineHeight: '1.4' }, // Adjust grid columns for label/value
        metricLabel: { color: '#4b5563', whiteSpace: 'nowrap' },
        metricValue: { fontWeight: 500, textAlign: 'right', color: '#111827' },
        metricValuePositive: { fontWeight: 600, textAlign: 'right', color: '#16a34a' },
        metricValueNegative: { fontWeight: 600, textAlign: 'right', color: '#dc2626' },
        summarySubTitle: { fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }, // Subtitle style
        taxBlock: { gridColumn: 'span 2 / span 2', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }
    };

    const insightStyles: { [key: string]: React.CSSProperties } = {
        insightContainer: { marginBottom: '1.5rem', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: '#ffffff' },
        insightTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' },
        insightList: { listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem' },
        insightItem: { display: 'flex', alignItems: 'center', marginBottom: '0.5rem', lineHeight: '1.3' },
        insightIcon: { marginRight: '0.5rem', height: '1rem', width: '1rem', flexShrink: 0 },
        // Colors defined within getVarianceColor or directly below
        insightTextGood: { color: '#16a34a' },
        insightTextBad: { color: '#dc2626' },
        insightTextNeutral: { color: '#4b5563' },
    };
    // --- End Styles ---

    return (
        <div style={styles.body}>
            <h1 style={styles.h1}>Финансовый отчет: {project.name || 'Проект'} (#{project.number || project.id.substring(0, 6)})</h1>

            {/* Project Details */}
            <div style={styles.section}>
                <h2 style={styles.h2}>Детали проекта</h2>
                <div style={styles.grid}>
                    <div style={styles.gridItem}><span style={styles.label}>Название:</span> <span style={styles.value}>{project.name || 'N/A'}</span></div>
                    <div style={styles.gridItem}><span style={styles.label}>Номер:</span> <span style={styles.value}>{project.number || 'N/A'}</span></div>
                    <div style={styles.gridItem}><span style={styles.label}>Заказчик:</span> <span style={styles.value}>{project.customer || 'N/A'}</span></div>
                    <div style={styles.gridItem}><span style={styles.label}>Статус:</span> <span style={styles.value}>{translateStatus(project.status)}</span></div>
                    <div style={styles.gridItem}><span style={styles.label}>Срок сдачи:</span> <span style={styles.value}>{formatDate(project.duedate)}</span></div>
                    {/* Add manager if needed/available */} 
                </div>
            </div>

            {/* Key Insights Section */}
            <div style={insightStyles.insightContainer}>
                <h2 style={insightStyles.insightTitle}>Ключевые показатели</h2>
                <ul style={insightStyles.insightList}>
                    {/* Budget Status -> Cost Status */}
                    <li style={insightStyles.insightItem}>
                        <span style={{ ...insightStyles.insightIcon, color: getVarianceColor(financialSummary.budgetVariance, false) }}>💰</span>
                        <span style={{ color: getVarianceColor(financialSummary.budgetVariance, false) }}>
                            Себестоимость: {financialSummary.budgetVariance === undefined || financialSummary.budgetVariance === null || Math.abs(financialSummary.budgetVariance) < 0.01 ? 'В рамках плана' :
                                financialSummary.budgetVariance < 0 ? `Экономия ${formatCurrency(Math.abs(financialSummary.budgetVariance))}` :
                                `Перерасход ${formatCurrency(financialSummary.budgetVariance)}`}
                            {(financialSummary.budgetVariancePercent !== undefined && Math.abs(financialSummary.budgetVariancePercent) >= 0.1) && ` (${formatPercentage(financialSummary.budgetVariancePercent)})`}
                        </span>
                    </li>
                    {/* Revenue Status */}
                    <li style={insightStyles.insightItem}>
                        <span style={{ ...insightStyles.insightIcon, color: getVarianceColor(financialSummary.revenueVariance, true) }}>📈</span>
                        <span style={{ color: getVarianceColor(financialSummary.revenueVariance, true) }}>
                            Выручка: {financialSummary.revenueVariance === undefined || financialSummary.revenueVariance === null || Math.abs(financialSummary.revenueVariance) < 0.01 ? 'По плану' :
                                financialSummary.revenueVariance > 0 ? `Выше плана на ${formatCurrency(financialSummary.revenueVariance)}` :
                                `Ниже плана на ${formatCurrency(Math.abs(financialSummary.revenueVariance))}`}
                            {(financialSummary.revenueVariancePercent !== undefined && Math.abs(financialSummary.revenueVariancePercent) >= 0.1) && ` (${formatPercentage(financialSummary.revenueVariancePercent)})`}
                        </span>
                    </li>
                    {/* Margin Status */}
                    <li style={insightStyles.insightItem}>
                        <span style={{ ...insightStyles.insightIcon, color: getVarianceColor(financialSummary.marginVariancePercent, true) }}>📊</span>
                        <span style={{ color: getVarianceColor(financialSummary.marginVariancePercent, true) }}>
                            Маржа (Факт vs План): {formatPercentage(financialSummary.actualMargin)} vs {formatPercentage(financialSummary.plannedMargin)}
                            {(financialSummary.marginVariancePercent !== undefined && Math.abs(financialSummary.marginVariancePercent) >= 0.1) && ` (${financialSummary.marginVariancePercent > 0 ? '+' : ''}${financialSummary.marginVariancePercent?.toFixed(1)} п.п.)`}
                        </span>
                    </li>
                    {/* Overdue Invoices */}
                    {invoiceSummary.overdueCount > 0 && (
                        <li style={insightStyles.insightItem}>
                            <span style={{ ...insightStyles.insightIcon, color: insightStyles.insightTextBad.color }}>⏱️</span>
                            <span style={insightStyles.insightTextBad}>Просрочено счетов: {invoiceSummary.overdueCount}</span>
                        </li>
                    )}
                    {/* Pending Invoices */}
                    {invoiceSummary.countByStatus['pending_payment'] > 0 && (
                         <li style={insightStyles.insightItem}>
                            <span style={{ ...insightStyles.insightIcon, color: insightStyles.insightTextNeutral.color }}>⏳</span>
                            <span style={insightStyles.insightTextNeutral}>Ожидают оплаты: {invoiceSummary.countByStatus['pending_payment'] || 0} ({formatCurrency(invoiceSummary.pendingAmount, '0 ₽')})</span>
                        </li>
                    )}
                     {/* Add more insights: Missing Docs? */} 
                </ul>
            </div>

            {/* Financial Summary Section */}
            <div style={summaryStyles.summaryContainer}>
                <h2 style={summaryStyles.sectionTitle}>Финансовая сводка</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}> {/* Responsive Grid */} 
                    {/* Metrics Block */}
                    <div>
                        <h3 style={summaryStyles.summarySubTitle}>План / Факт</h3>
                        <div style={summaryStyles.metricGrid}>
                            <span style={summaryStyles.metricLabel}>Себестоимость (План):</span>
                            <span style={summaryStyles.metricValue}>{formatCurrency(project.planned_budget)}</span>
                            <span style={summaryStyles.metricLabel}>Себестоимость (Факт):</span>
                            <span style={summaryStyles.metricValue}>{formatCurrency(project.actual_budget)}</span>
                            <span style={summaryStyles.metricLabel}>Отклонение:</span>
                            <span style={{...summaryStyles.metricValue, color: getVarianceColor(financialSummary.budgetVariance, false)}}>
                                {formatCurrency(financialSummary.budgetVariance)} ({formatPercentage(financialSummary.budgetVariancePercent)})
                            </span>

                            <span style={summaryStyles.metricLabel}>Выручка (План):</span>
                            <span style={summaryStyles.metricValue}>{formatCurrency(project.planned_revenue)}</span>
                            <span style={summaryStyles.metricLabel}>Выручка (Факт):</span>
                            <span style={summaryStyles.metricValue}>{formatCurrency(project.actual_revenue)}</span>
                            <span style={summaryStyles.metricLabel}>Отклонение:</span>
                            <span style={{...summaryStyles.metricValue, color: getVarianceColor(financialSummary.revenueVariance, true)}}>
                                {formatCurrency(financialSummary.revenueVariance)} ({formatPercentage(financialSummary.revenueVariancePercent)})
                            </span>

                            <span style={summaryStyles.metricLabel}>Маржа (План):</span>
                            <span style={summaryStyles.metricValue}>{formatPercentage(financialSummary.plannedMargin)}</span>
                            <span style={summaryStyles.metricLabel}>Валовая Маржа (Факт):</span>
                            <span style={summaryStyles.metricValue}>{formatPercentage(financialSummary.actualMargin)}</span>
                            <span style={summaryStyles.metricLabel}>Отклонение:</span>
                            <span style={{...summaryStyles.metricValue, color: getVarianceColor(financialSummary.marginVariancePercent, true)}}>
                                {financialSummary.marginVariancePercent !== undefined ? `${financialSummary.marginVariancePercent > 0 ? '+' : ''}${financialSummary.marginVariancePercent?.toFixed(1)} п.п.` : 'N/A'}
                            </span>
                        </div>
                    </div>
                    {/* Budget Usage Block -> Cost Usage Block */}
                    <div>
                        <h3 style={summaryStyles.summarySubTitle}>Использование себестоимости (Факт)</h3>
                        <div style={summaryStyles.metricGrid}>
                            <span style={summaryStyles.metricLabel}>Себестоимость (Факт):</span>
                            <span style={summaryStyles.metricValue}>{formatCurrency(project.actual_budget)}</span>
                            <span style={summaryStyles.metricLabel}>Потрачено (Счета+Налоги):</span>
                            <span style={summaryStyles.metricValueNegative}>{formatCurrency(financialSummary.totalSpent)}</span>
                            <span style={{...summaryStyles.metricLabel, fontWeight: 600 }}>Нераспределенный остаток (Факт):</span>
                            <span style={financialSummary.remainingCost >= 0 ? summaryStyles.metricValuePositive : summaryStyles.metricValueNegative}>
                                {formatCurrency(financialSummary.remainingCost)}
                            </span>
                        </div>
                        <BudgetProgressBar spent={financialSummary.totalSpent} budget={project.actual_budget} />
                    </div>

                    {/* Tax & Net Profit Block */} 
                    {(project.usn_tax !== undefined || project.nds_tax !== undefined || financialSummary.estimatedNetProfit !== undefined) && (
                        <div style={summaryStyles.taxBlock}>
                            <h3 style={summaryStyles.summarySubTitle}>Налоги и чистая прибыль (Оценка)</h3>
                            <div style={summaryStyles.metricGrid}>
                                <span style={{...summaryStyles.metricLabel, fontWeight: 600 }}>Валовая Прибыль (Факт):</span>
                                <span style={summaryStyles.metricValuePositive}>{formatCurrency((project.actual_revenue ?? 0) - (project.actual_budget ?? 0))}</span>
                                <span style={summaryStyles.metricLabel}>УСН (1.5%):</span>
                                <span style={summaryStyles.metricValue}>{formatCurrency(project.usn_tax)}</span>
                                <span style={summaryStyles.metricLabel}>НДС (5%):</span>
                                <span style={summaryStyles.metricValue}>{formatCurrency(project.nds_tax)}</span>
                                <span style={{...summaryStyles.metricLabel, fontWeight: 600 }}>Чистая Прибыль (Факт):</span>
                                <span style={summaryStyles.metricValuePositive}>{formatCurrency(financialSummary.estimatedNetProfit)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Invoices Table */}
            <div style={styles.section}>
                <h2 style={styles.h2}>Счета ({invoices.length})</h2>
                {invoices.length > 0 ? (
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Поставщик</th>
                                <th style={styles.th}>Сумма</th>
                                <th style={styles.th}>Статус</th>
                                <th style={styles.th}>Срок оплаты</th>
                                <th style={styles.th}>Закр. документы</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((invoice) => (
                                <tr key={invoice.id}>
                                    <td style={styles.td}>
                                        {invoice.fileURL ? (
                                            <a href={invoice.fileURL} target="_blank" rel="noopener noreferrer" style={styles.link}>
                                                {invoice.supplierName || 'N/A'}
                                            </a>
                                        ) : (
                                            invoice.supplierName || 'N/A'
                                        )}
                                    </td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatCurrency(invoice.amount)}</td>
                                    <td style={styles.td}>{translateStatus(invoice.status)}</td>
                                    <td style={styles.td}>{formatDate(invoice.dueDate)}</td>
                                    <td style={styles.td}>
                                        {invoice.closingDocuments.length > 0 ? (
                                            <ul style={styles.ul}>
                                                {invoice.closingDocuments.map(doc => (
                                                    <li key={doc.id} style={styles.li} title={`Загружен: ${formatDate(doc.uploadedAt)}`}>
                                                        {doc.fileURL ? (
                                                            <a href={doc.fileURL} target="_blank" rel="noopener noreferrer" style={styles.link}>
                                                                {doc.fileName}
                                                            </a>
                                                        ) : (
                                                            doc.fileName
                                                        )}
                                                        {doc.date ? ` (от ${formatDate(doc.date)})` : ''}
                                                    </li>
                                                // Sort docs by upload date (desc) or filename as fallback
                                                )).sort((a, b) => { 
                                                    const dateA = a.props.title ? new Date(a.props.title.split(': ')[1]).getTime() : 0;
                                                    const dateB = b.props.title ? new Date(b.props.title.split(': ')[1]).getTime() : 0;
                                                    return (dateB || 0) - (dateA || 0);
                                                })}
                                            </ul>
                                        ) : (
                                            <span style={styles.noDataSpan}>Нет</span>
                                        )}
                                    </td>
                                </tr>
                            // Sort invoices by due date (earliest first) or creation date
                            )).sort((a, b) => {
                                // Attempt to get date string from the rendered output (less reliable)
                                const dateStrA = a.props?.children?.[3]?.props?.children as string | undefined;
                                const dateStrB = b.props?.children?.[3]?.props?.children as string | undefined;
                                // Basic parse DD.MM.YYYY - adjust if format differs
                                const parseDate = (str?: string) => {
                                     if (!str || str === 'N/A' || str === 'Invalid Date') return 0;
                                     const parts = str.split('.');
                                     return parts.length === 3 ? new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime() : 0;
                                }; 
                                const dateA = parseDate(dateStrA);
                                const dateB = parseDate(dateStrB); 
                                return (dateA || 0) - (dateB || 0);
                            })}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: '#6b7280' }}>Счета по проекту отсутствуют.</p>
                )}
            </div>

            {/* Supplier Spending Table */}
            {supplierSpending.length > 0 && (
                <div style={styles.section}>
                    <h2 style={styles.h2}>Расходы по поставщикам</h2>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Поставщик</th>
                                <th style={{...styles.th, textAlign: 'right'}}>Сумма</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supplierSpending.map(([name, amount]) => (
                                <tr key={name}>
                                    <td style={styles.td}>{name}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{formatCurrency(amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={styles.footer}>
                Отчет сгенерирован: {new Date().toLocaleString('ru-RU')}
            </div>
        </div>
    );
};

export default ProjectFinancialReport; 