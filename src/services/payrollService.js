const { query } = require('../config/database');
const {
  LATE_DEDUCTION_PER_MIN, OT_PAY_PER_MIN, PERFECT_ATTENDANCE_BONUS,
  isHoliday,
} = require('../config/constants');

async function calcMonthlyPayroll(year, month) {
  const users = await query('SELECT * FROM users WHERE is_active = true ORDER BY name');
  const results = [];

  for (const user of users.rows) {
    const att = await query(
      `SELECT * FROM attendance
       WHERE user_id = $1
         AND EXTRACT(YEAR FROM work_date) = $2
         AND EXTRACT(MONTH FROM work_date) = $3`,
      [user.id, year, month]
    );

    let totalLateMin = 0, totalOtMin = 0;
    let presentDays = 0, lateCount = 0, absentCount = 0, leaveCount = 0;
    let holidayDaysWorked = 0;

    for (const rec of att.rows) {
      if (rec.check_in_time) presentDays++;
      totalLateMin += rec.late_minutes || 0;
      totalOtMin += rec.ot_minutes || 0;
      if (rec.late_minutes > 0) lateCount++;
      if (rec.status === 'absent') absentCount++;
      if (rec.status === 'leave') leaveCount++;
      const dateStr = new Date(rec.work_date).toISOString().split('T')[0];
      if (isHoliday(dateStr) && rec.check_in_time) holidayDaysWorked++;
    }

    // Base salary
    const salaryType = user.salary_type || 'monthly';
    const salaryAmount = parseFloat(user.salary_amount || 0);
    let baseSalary = salaryType === 'daily'
      ? presentDays * salaryAmount
      : salaryAmount;

    // Holiday worked = extra 1x (already got base, so add 1x more)
    // Daily: they get their base already, add 1x per holiday worked
    // Monthly: add (salary/work_days_in_month) per holiday worked
    const workDaysInMonth = getWorkDaysInMonth(year, month);
    const dailyRateForMonthly = workDaysInMonth > 0 ? salaryAmount / workDaysInMonth : 0;
    const holidayBonus = salaryType === 'daily'
      ? holidayDaysWorked * salaryAmount
      : holidayDaysWorked * dailyRateForMonthly;

    // Commission for the month
    const commRes = await query(
      'SELECT sales_amount, commission_amount FROM commissions WHERE user_id = $1 AND year = $2 AND month = $3',
      [user.id, year, month]
    );
    const salesAmount = parseFloat(commRes.rows[0]?.sales_amount || 0);
    const commission = parseFloat(commRes.rows[0]?.commission_amount || 0);

    // Manual extras
    const extRes = await query(
      'SELECT * FROM payroll_extras WHERE user_id = $1 AND year = $2 AND month = $3',
      [user.id, year, month]
    );
    const extras = extRes.rows[0] || {};
    const productCommission = parseFloat(extras.product_commission || 0);
    const manualHolidayPay = parseFloat(extras.holiday_pay || 0);
    const socialSecurity = parseFloat(extras.social_security || 0);
    const absentDeduction = parseFloat(extras.absent_deduction || 0);

    // Perfect attendance bonus
    const perfectBonus = (lateCount === 0 && absentCount === 0 && leaveCount === 0)
      ? PERFECT_ATTENDANCE_BONUS : 0;

    const lateDeduction = totalLateMin * LATE_DEDUCTION_PER_MIN;
    const otEarnings = totalOtMin * OT_PAY_PER_MIN;

    const totalIncome = baseSalary + otEarnings + commission + productCommission + holidayBonus + manualHolidayPay + perfectBonus;
    const totalDeduction = lateDeduction + socialSecurity + absentDeduction;
    const netSalary = Math.max(0, totalIncome - totalDeduction);

    results.push({
      userId: user.id,
      name: user.name,
      role: user.role,
      salaryType,
      salaryAmount,
      baseSalary,
      presentDays,
      absentCount,
      leaveCount,
      holidayDaysWorked,
      holidayBonus,
      manualHolidayPay,
      lateCount,
      totalLateMin,
      totalOtMin,
      lateDeduction,
      otEarnings,
      salesAmount,
      commission,
      productCommission,
      socialSecurity,
      absentDeduction,
      perfectBonus,
      totalIncome,
      totalDeduction,
      netSalary,
    });
  }

  return results;
}

// Count working days in a month (Mon–Sat, excluding Sun)
function getWorkDaysInMonth(year, month) {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() !== 0) count++; // exclude Sunday
    date.setDate(date.getDate() + 1);
  }
  return count;
}

module.exports = { calcMonthlyPayroll, getWorkDaysInMonth };
