'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import { getProject } from '@/lib/store/db';
import Pipeline from '@/components/ui/Pipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function cls(...classes: string[]): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Reusable UI atoms
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
      {children}
    </h2>
  );
}

function InputField({
  label,
  value,
  onChange,
  suffix,
  prefix,
  step,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  prefix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-text-secondary text-sm mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-text-muted text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step ?? 0.01}
          min={min}
          max={max}
          className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-teal"
        />
        {suffix && <span className="text-text-muted text-sm">{suffix}</span>}
      </div>
      {hint && <p className="text-text-muted text-xs mt-0.5">{hint}</p>}
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: 'teal' | 'orange' | 'success' | 'error' | 'default';
}) {
  const textColor = {
    teal: 'text-accent-teal',
    orange: 'text-accent-orange',
    success: 'text-success',
    error: 'text-error',
    default: 'text-text-primary',
  }[color ?? 'default'];

  return (
    <div className="bg-bg-input border border-border rounded-lg p-3">
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className={cls('text-xl font-bold', textColor)}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CalculatorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Section 1: Product Economics
  const [sellingPrice, setSellingPrice] = useState(49.99);
  const [cogs, setCogs] = useState(12.0);
  const [shippingCost, setShippingCost] = useState(5.0);
  const [paymentFeePercent, setPaymentFeePercent] = useState(2.9);
  const [paymentFeeFixed, setPaymentFeeFixed] = useState(0.3);
  const [otherCosts, setOtherCosts] = useState(0);
  const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');

  // Section 3: Ad Spend Simulator
  const [dailyAdSpend, setDailyAdSpend] = useState(100);
  const [expectedCTR, setExpectedCTR] = useState(1.5);
  const [expectedCVR, setExpectedCVR] = useState(2.5);
  const [expectedCPC, setExpectedCPC] = useState(0.8);

  // Section 2: Target ROAS slider
  const [targetROAS, setTargetROAS] = useState(3.0);

  const currencySymbol = currency === 'EUR' ? '\u20AC' : '$';

  // ---- Load project ----
  useEffect(() => {
    (async () => {
      const p = await getProject(projectId);
      if (!p) {
        router.push('/');
        return;
      }
      setProject(p);

      // Pre-fill price from Shopify data if available
      if (p.shopifyData?.price) {
        setSellingPrice(parseFloat(p.shopifyData.price) || 49.99);
        if (p.shopifyData.currency === 'USD') setCurrency('USD');
      }

      setLoading(false);
    })();
  }, [projectId, router]);

  // ---- Derived calculations ----

  const economics = useMemo(() => {
    const paymentFee = sellingPrice * (paymentFeePercent / 100) + paymentFeeFixed;
    const totalCosts = cogs + shippingCost + paymentFee + otherCosts;
    const profitPerUnit = sellingPrice - totalCosts;
    const grossMarginPercent = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
    return { paymentFee, totalCosts, profitPerUnit, grossMarginPercent };
  }, [sellingPrice, cogs, shippingCost, paymentFeePercent, paymentFeeFixed, otherCosts]);

  const breakeven = useMemo(() => {
    const marginFraction = economics.grossMarginPercent / 100;
    const breakevenROAS = marginFraction > 0 ? 1 / marginFraction : Infinity;
    const maxCPA = economics.profitPerUnit > 0 ? economics.profitPerUnit : 0;
    const targetCPA = sellingPrice > 0 ? sellingPrice / targetROAS : 0;
    return { breakevenROAS, maxCPA, targetCPA };
  }, [economics, targetROAS, sellingPrice]);

  const simulator = useMemo(() => {
    const dailyClicks = expectedCPC > 0 ? dailyAdSpend / expectedCPC : 0;
    const dailyConversions = dailyClicks * (expectedCVR / 100);
    const dailyRevenue = dailyConversions * sellingPrice;
    const dailyProfit = dailyConversions * economics.profitPerUnit - dailyAdSpend;
    const dailyROAS = dailyAdSpend > 0 ? dailyRevenue / dailyAdSpend : 0;
    const cpa = dailyConversions > 0 ? dailyAdSpend / dailyConversions : 0;
    return {
      dailyClicks,
      dailyConversions,
      dailyRevenue,
      dailyProfit,
      dailyROAS,
      cpa,
      monthlyRevenue: dailyRevenue * 30,
      monthlyProfit: dailyProfit * 30,
      monthlyAdSpend: dailyAdSpend * 30,
      monthlyConversions: dailyConversions * 30,
    };
  }, [dailyAdSpend, expectedCPC, expectedCVR, sellingPrice, economics.profitPerUnit]);

  const scalingRows = useMemo(() => {
    const spends = [50, 100, 250, 500, 1000, 2000];
    return spends.map((spend) => {
      const clicks = expectedCPC > 0 ? spend / expectedCPC : 0;
      const conversions = clicks * (expectedCVR / 100);
      const revenue = conversions * sellingPrice;
      const roas = spend > 0 ? revenue / spend : 0;
      const netProfit = conversions * economics.profitPerUnit - spend;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
      return { spend, clicks, conversions, revenue, roas, netProfit, profitMargin };
    });
  }, [expectedCPC, expectedCVR, sellingPrice, economics.profitPerUnit]);

  // ---- Rendering ----

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex">
      <Pipeline project={project} />

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            ROAS &amp; Profitability Calculator
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Know your numbers before you spend a single {currencySymbol} on ads.
          </p>
          {/* Currency toggle */}
          <div className="flex gap-2 mt-3">
            {(['EUR', 'USD'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cls(
                  'px-3 py-1 rounded-lg text-sm font-medium border',
                  currency === c
                    ? 'bg-accent-teal text-bg-primary border-accent-teal'
                    : 'bg-bg-card text-text-secondary border-border hover:border-accent-teal'
                )}
              >
                {c === 'EUR' ? '\u20AC EUR' : '$ USD'}
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION 1: Product Economics                                     */}
        {/* ================================================================ */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <SectionTitle>
            <span className="text-accent-teal">01</span> Product Economics
          </SectionTitle>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <InputField
              label="Selling Price"
              value={sellingPrice}
              onChange={setSellingPrice}
              prefix={currencySymbol}
            />
            <InputField
              label="COGS (Cost of Goods)"
              value={cogs}
              onChange={setCogs}
              prefix={currencySymbol}
            />
            <InputField
              label="Shipping Cost"
              value={shippingCost}
              onChange={setShippingCost}
              prefix={currencySymbol}
            />
            <InputField
              label="Payment Processing Fee"
              value={paymentFeePercent}
              onChange={setPaymentFeePercent}
              suffix="%"
              hint={`+ ${currencySymbol}${paymentFeeFixed} fixed`}
            />
            <InputField
              label="Fixed Payment Fee"
              value={paymentFeeFixed}
              onChange={setPaymentFeeFixed}
              prefix={currencySymbol}
              step={0.01}
            />
            <InputField
              label="Other Costs"
              value={otherCosts}
              onChange={setOtherCosts}
              prefix={currencySymbol}
            />
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Payment Fee / unit"
              value={`${currencySymbol}${fmt(economics.paymentFee)}`}
            />
            <MetricCard
              label="Total Costs / unit"
              value={`${currencySymbol}${fmt(economics.totalCosts)}`}
              color="orange"
            />
            <MetricCard
              label="Profit / unit"
              value={`${currencySymbol}${fmt(economics.profitPerUnit)}`}
              color={economics.profitPerUnit >= 0 ? 'success' : 'error'}
            />
            <MetricCard
              label="Gross Margin"
              value={`${fmt(economics.grossMarginPercent)}%`}
              color={economics.grossMarginPercent >= 30 ? 'teal' : economics.grossMarginPercent >= 15 ? 'orange' : 'error'}
            />
          </div>
        </section>

        {/* ================================================================ */}
        {/* SECTION 2: Break-even Analysis                                   */}
        {/* ================================================================ */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <SectionTitle>
            <span className="text-accent-teal">02</span> Break-even Analysis
          </SectionTitle>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard
              label="Break-even ROAS"
              value={breakeven.breakevenROAS === Infinity ? 'N/A' : `${fmt(breakeven.breakevenROAS)}x`}
              color="orange"
            />
            <MetricCard
              label="Max CPA (break-even)"
              value={`${currencySymbol}${fmt(breakeven.maxCPA)}`}
              color="teal"
            />
            <MetricCard
              label={`Target CPA at ${fmt(targetROAS, 1)}x`}
              value={`${currencySymbol}${fmt(breakeven.targetCPA)}`}
              color="success"
            />
            <MetricCard
              label="Target Profit / sale"
              value={`${currencySymbol}${fmt(economics.profitPerUnit - breakeven.targetCPA)}`}
              color={economics.profitPerUnit - breakeven.targetCPA >= 0 ? 'success' : 'error'}
            />
          </div>

          {/* ROAS Slider */}
          <div>
            <label className="text-text-secondary text-sm block mb-2">
              Target ROAS: <span className="text-accent-orange font-bold">{fmt(targetROAS, 1)}x</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={targetROAS}
              onChange={(e) => setTargetROAS(parseFloat(e.target.value))}
              className="w-full accent-accent-orange"
            />
            <div className="flex justify-between text-text-muted text-xs mt-1">
              <span>1x</span>
              <span>Break-even: {breakeven.breakevenROAS === Infinity ? 'N/A' : `${fmt(breakeven.breakevenROAS, 1)}x`}</span>
              <span>10x</span>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SECTION 3: Ad Spend Simulator                                    */}
        {/* ================================================================ */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <SectionTitle>
            <span className="text-accent-teal">03</span> Ad Spend Simulator
          </SectionTitle>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <InputField
              label="Daily Ad Spend"
              value={dailyAdSpend}
              onChange={setDailyAdSpend}
              prefix={currencySymbol}
              step={10}
              min={0}
            />
            <InputField
              label="Expected CTR"
              value={expectedCTR}
              onChange={setExpectedCTR}
              suffix="%"
              step={0.1}
              min={0}
              max={100}
            />
            <InputField
              label="Expected CVR"
              value={expectedCVR}
              onChange={setExpectedCVR}
              suffix="%"
              step={0.1}
              min={0}
              max={100}
            />
            <InputField
              label="Expected CPC"
              value={expectedCPC}
              onChange={setExpectedCPC}
              prefix={currencySymbol}
              step={0.01}
              min={0}
            />
          </div>

          {/* Daily results */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard label="Daily Clicks" value={fmt(simulator.dailyClicks, 0)} />
            <MetricCard label="Daily Conversions" value={fmt(simulator.dailyConversions, 1)} />
            <MetricCard label="Daily Revenue" value={`${currencySymbol}${fmt(simulator.dailyRevenue)}`} color="teal" />
            <MetricCard
              label="Daily ROAS"
              value={`${fmt(simulator.dailyROAS, 2)}x`}
              color={simulator.dailyROAS >= breakeven.breakevenROAS ? 'success' : 'error'}
            />
            <MetricCard label="CPA" value={`${currencySymbol}${fmt(simulator.cpa)}`} color={simulator.cpa <= breakeven.maxCPA ? 'success' : 'error'} />
            <MetricCard
              label="Daily Profit"
              value={`${simulator.dailyProfit >= 0 ? '+' : ''}${currencySymbol}${fmt(simulator.dailyProfit)}`}
              color={simulator.dailyProfit >= 0 ? 'success' : 'error'}
            />
          </div>

          {/* Profit vs Ad Spend bar */}
          <div className="mb-4">
            <p className="text-text-muted text-xs mb-2">Revenue vs Ad Spend (daily)</p>
            <div className="flex gap-2 items-end h-16">
              <div className="flex-1">
                <div
                  className="bg-accent-teal/30 border border-accent-teal rounded-t"
                  style={{
                    height: `${Math.min(100, (simulator.dailyRevenue / Math.max(simulator.dailyRevenue, dailyAdSpend, 1)) * 64)}px`,
                  }}
                />
                <p className="text-xs text-text-muted mt-1">Revenue</p>
              </div>
              <div className="flex-1">
                <div
                  className="bg-accent-orange/30 border border-accent-orange rounded-t"
                  style={{
                    height: `${Math.min(100, (dailyAdSpend / Math.max(simulator.dailyRevenue, dailyAdSpend, 1)) * 64)}px`,
                  }}
                />
                <p className="text-xs text-text-muted mt-1">Ad Spend</p>
              </div>
              <div className="flex-1">
                <div
                  className={cls(
                    'rounded-t border',
                    simulator.dailyProfit >= 0
                      ? 'bg-success/20 border-success'
                      : 'bg-error/20 border-error'
                  )}
                  style={{
                    height: `${Math.min(100, (Math.abs(simulator.dailyProfit) / Math.max(simulator.dailyRevenue, dailyAdSpend, 1)) * 64)}px`,
                  }}
                />
                <p className="text-xs text-text-muted mt-1">{simulator.dailyProfit >= 0 ? 'Profit' : 'Loss'}</p>
              </div>
            </div>
          </div>

          {/* Monthly projections */}
          <div className="bg-bg-primary border border-border rounded-lg p-4">
            <p className="text-text-secondary text-sm font-medium mb-3">Monthly Projections (30 days)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Ad Spend" value={`${currencySymbol}${fmt(simulator.monthlyAdSpend, 0)}`} color="orange" />
              <MetricCard label="Revenue" value={`${currencySymbol}${fmt(simulator.monthlyRevenue, 0)}`} color="teal" />
              <MetricCard label="Conversions" value={fmt(simulator.monthlyConversions, 0)} />
              <MetricCard
                label="Net Profit"
                value={`${simulator.monthlyProfit >= 0 ? '+' : ''}${currencySymbol}${fmt(simulator.monthlyProfit, 0)}`}
                color={simulator.monthlyProfit >= 0 ? 'success' : 'error'}
              />
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SECTION 4: Scaling Table                                         */}
        {/* ================================================================ */}
        <section className="bg-bg-card border border-border rounded-xl p-5">
          <SectionTitle>
            <span className="text-accent-teal">04</span> Scaling Scenarios
          </SectionTitle>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 px-3">Daily Spend</th>
                  <th className="text-right py-2 px-3">Clicks</th>
                  <th className="text-right py-2 px-3">Conv.</th>
                  <th className="text-right py-2 px-3">Revenue</th>
                  <th className="text-right py-2 px-3">ROAS</th>
                  <th className="text-right py-2 px-3">Net Profit</th>
                  <th className="text-right py-2 px-3">Margin</th>
                </tr>
              </thead>
              <tbody>
                {scalingRows.map((row) => {
                  const isProfit = row.netProfit > 1;
                  const isLoss = row.netProfit < -1;
                  const rowColor = isProfit
                    ? 'bg-success/5'
                    : isLoss
                      ? 'bg-error/5'
                      : 'bg-warning/5';
                  return (
                    <tr
                      key={row.spend}
                      className={cls(rowColor, 'border-b border-border/50 hover:bg-bg-card-hover')}
                    >
                      <td className="py-2.5 px-3 font-medium text-text-primary">
                        {currencySymbol}{fmt(row.spend, 0)}/day
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-secondary">{fmt(row.clicks, 0)}</td>
                      <td className="py-2.5 px-3 text-right text-text-secondary">{fmt(row.conversions, 1)}</td>
                      <td className="py-2.5 px-3 text-right text-text-secondary">
                        {currencySymbol}{fmt(row.revenue, 0)}
                      </td>
                      <td className={cls(
                        'py-2.5 px-3 text-right font-medium',
                        row.roas >= breakeven.breakevenROAS ? 'text-success' : 'text-error'
                      )}>
                        {fmt(row.roas, 2)}x
                      </td>
                      <td className={cls(
                        'py-2.5 px-3 text-right font-bold',
                        isProfit ? 'text-success' : isLoss ? 'text-error' : 'text-warning'
                      )}>
                        {row.netProfit >= 0 ? '+' : ''}{currencySymbol}{fmt(row.netProfit, 0)}
                      </td>
                      <td className={cls(
                        'py-2.5 px-3 text-right',
                        row.profitMargin >= 0 ? 'text-text-secondary' : 'text-error'
                      )}>
                        {fmt(row.profitMargin, 1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-text-muted text-xs mt-3">
            Based on CPC {currencySymbol}{fmt(expectedCPC)}, CVR {fmt(expectedCVR, 1)}%, margin {currencySymbol}{fmt(economics.profitPerUnit)} / unit.
          </p>
        </section>

        {/* ================================================================ */}
        {/* SECTION 5: Quick Summary Card                                    */}
        {/* ================================================================ */}
        <section className="bg-bg-card border border-accent-teal/30 rounded-xl p-6">
          <SectionTitle>
            <span className="text-accent-orange">05</span> Quick Summary
          </SectionTitle>

          <div className="bg-bg-primary border border-border rounded-xl p-5 space-y-4 max-w-lg">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-text-muted text-sm">Project</span>
              <span className="text-text-primary font-medium text-sm">{project.name}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-text-muted text-sm">Selling Price</span>
              <span className="text-text-primary font-medium">{currencySymbol}{fmt(sellingPrice)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-text-muted text-sm">Profit / Unit</span>
              <span className={cls('font-bold', economics.profitPerUnit >= 0 ? 'text-success' : 'text-error')}>
                {currencySymbol}{fmt(economics.profitPerUnit)}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-text-muted text-sm">Gross Margin</span>
              <span className="text-accent-teal font-bold">{fmt(economics.grossMarginPercent)}%</span>
            </div>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-text-muted text-sm">Break-even ROAS</span>
              <span className="text-accent-orange font-bold">
                {breakeven.breakevenROAS === Infinity ? 'N/A' : `${fmt(breakeven.breakevenROAS)}x`}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-text-muted text-sm">Max CPA</span>
              <span className="text-text-primary font-medium">{currencySymbol}{fmt(breakeven.maxCPA)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted text-sm">Projected Monthly Profit</span>
              <span className={cls('font-bold text-lg', simulator.monthlyProfit >= 0 ? 'text-success' : 'text-error')}>
                {simulator.monthlyProfit >= 0 ? '+' : ''}{currencySymbol}{fmt(simulator.monthlyProfit, 0)}
              </span>
            </div>
          </div>

          <p className="text-text-muted text-xs mt-3">
            At {currencySymbol}{fmt(dailyAdSpend, 0)}/day, CPC {currencySymbol}{fmt(expectedCPC)}, CVR {fmt(expectedCVR, 1)}%
          </p>
        </section>
      </div>
    </div>
  );
}
