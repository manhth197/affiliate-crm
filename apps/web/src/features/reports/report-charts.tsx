import { format, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Chart conventions (dataviz skill): every chart here shows a magnitude, so it uses ONE hue;
 * identity comes from axis labels, never from colour. Thin marks with 4px rounded data ends,
 * a recessive grid, one axis, a hover tooltip, and a table view next to each chart.
 * No entry animation: it delays the value labels and adds nothing to a report.
 */
const MARK = 'var(--color-sky-600)'
const GRID = 'var(--border)'
const INK_MUTED = 'var(--muted-foreground)'
const AXIS_TICK = { fill: INK_MUTED, fontSize: 12 }

type TooltipBoxProps = { title: string; value: string }

function TooltipBox({ title, value }: TooltipBoxProps) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <div className="text-muted-foreground">{title}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  )
}

/** New leads per Vietnam calendar day (bars: discrete daily counts). */
export function LeadsPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240} initialDimension={{ width: 640, height: 240 }}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="date"
          tickFormatter={(day: string) => format(parseISO(day), 'dd/MM')}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as { date: string; count: number } | undefined
            if (!active || !point) return null
            return (
              <TooltipBox
                title={format(parseISO(point.date), 'dd/MM/yyyy')}
                value={`${point.count} lead`}
              />
            )
          }}
        />
        <Bar
          dataKey="count"
          fill={MARK}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

type Row = { label: string; value: number }

/** Horizontal bars for a few named categories, value printed at the bar end. */
export function CategoryBarChart({
  rows,
  formatValue,
}: {
  rows: Row[]
  formatValue: (value: number) => string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ResponsiveContainer
      width="100%"
      height={rows.length * 36 + 8}
      initialDimension={{ width: 420, height: rows.length * 36 + 8 }}
    >
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        {/* Room on the right for the value labels. */}
        <XAxis type="number" hide domain={[0, max * 1.45]} />
        <YAxis
          type="category"
          dataKey="label"
          width={104}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={({ active, payload }) => {
            const row = payload?.[0]?.payload as Row | undefined
            if (!active || !row) return null
            return <TooltipBox title={row.label} value={formatValue(row.value)} />
          }}
        />
        <Bar
          dataKey="value"
          fill={MARK}
          radius={[0, 4, 4, 0]}
          barSize={18}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground text-xs tabular-nums"
            formatter={(value: unknown) => formatValue(Number(value))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
