using SQLite, DataFrames, Statistics, Dates, JSON

# ================= CONNECT DATABASE =================
db = SQLite.DB("database.db")

df = DBInterface.execute(db, "SELECT * FROM expenses") |> DataFrame

if nrow(df) == 0
    println("No expense data found.")
    exit()
end

# ================= DATA CLEANING =================
df.amount = Float64.(df.amount)
df.date = Date.(df.date)

# ================= CATEGORY ANALYSIS =================
category = combine(groupby(df, :category), :amount => sum => :total)
sort!(category, :total, rev=true)

# ================= MONTHLY ANALYSIS =================
df.month = Dates.format.(df.date, "yyyy-mm")

monthly = combine(groupby(df, :month), :amount => sum => :total)

# ================= DAILY TREND =================
daily = combine(groupby(df, :date), :amount => sum => :total)

# ================= STATISTICS =================
total_spent = sum(df.amount)
avg_spent = mean(df.amount)
max_spent = maximum(df.amount)

top_category = category.category[1]

# ================= SMART INSIGHTS =================
insights = String[]

if total_spent > 0
    push!(insights, "Total spending is ₹$(round(total_spent, digits=2))")
end

if avg_spent > 0
    push!(insights, "Average expense is ₹$(round(avg_spent, digits=2))")
end

push!(insights, "Highest expense was ₹$(max_spent)")
push!(insights, "Top spending category is $(top_category)")

# Overspending detection (simple logic)
for row in eachrow(category)
    percent = (row.total / total_spent) * 100
    if percent > 40
        push!(insights, "High spending detected in $(row.category) ($(round(percent,digits=2))%)")
    end
end

# ================= SAVE JSON (MAIN OUTPUT) =================
output = Dict(
    "summary" => Dict(
        "total" => total_spent,
        "average" => avg_spent,
        "max" => max_spent,
        "top_category" => top_category
    ),
    "category" => category,
    "monthly" => monthly,
    "daily" => daily,
    "insights" => insights
)

open("analysis.json","w") do f
    JSON.print(f, output)
end

println("analysis.json generated")

