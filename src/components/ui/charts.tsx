
import React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart as RechartsBarChart,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

interface ChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showLegend?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGrid?: boolean;
}

export const BarChart = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => `${value}`,
  yAxisWidth = 40,
  showLegend = false,
  showXAxis = true,
  showYAxis = true,
  showGrid = true,
}: ChartProps) => {
  return (
    <ChartContainer
      config={{
        value: {
          theme: {
            light: colors[0],
            dark: colors[0],
          },
        },
      }}
    >
      <RechartsBarChart data={data} layout="horizontal">
        {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} />}
        {showXAxis && <XAxis dataKey={index} />}
        {showYAxis && <YAxis width={yAxisWidth} />}
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => valueFormatter(Number(value))}
            />
          }
        />
        {showLegend && <Legend />}
        {categories.map((category, i) => (
          <Bar
            key={category}
            dataKey={category}
            fill={colors[i % colors.length]}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
};

export const LineChart = ({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => `${value}`,
  yAxisWidth = 40,
  showLegend = false,
  showXAxis = true,
  showYAxis = true,
  showGrid = true,
}: ChartProps) => {
  return (
    <ChartContainer
      config={{
        value: {
          theme: {
            light: colors[0],
            dark: colors[0],
          },
        },
      }}
    >
      <RechartsLineChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        {showXAxis && <XAxis dataKey={index} />}
        {showYAxis && <YAxis width={yAxisWidth} />}
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => valueFormatter(Number(value))}
            />
          }
        />
        {showLegend && <Legend />}
        {categories.map((category, i) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            stroke={colors[i % colors.length]}
            activeDot={{ r: 8 }}
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
};

interface PieChartProps {
  data: any[];
  index: string;
  category: string;
  colors: string[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
}

export const PieChart = ({
  data,
  index,
  category,
  colors,
  valueFormatter = (value) => `${value}`,
  showLegend = false,
}: PieChartProps) => {
  return (
    <ChartContainer
      config={{
        value: {
          theme: {
            light: colors[0],
            dark: colors[0],
          },
        },
      }}
    >
      <RechartsPieChart>
        <Pie
          data={data}
          nameKey={index}
          dataKey={category}
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ name, value }) => `${name}: ${valueFormatter(value)}`}
        >
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => valueFormatter(Number(value))}
            />
          }
        />
        {showLegend && <Legend />}
      </RechartsPieChart>
    </ChartContainer>
  );
};
