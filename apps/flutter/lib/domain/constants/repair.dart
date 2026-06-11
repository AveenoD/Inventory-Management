const repairJobStatuses = [
  'RECEIVED',
  'IN_PROGRESS',
  'REPAIRED_PENDING_PICKUP',
  'DELIVERED',
  'UNREPAIRABLE_RETURNED',
];

const repairStatusLabels = <String, String>{
  'RECEIVED': 'Received',
  'IN_PROGRESS': 'In repair',
  'REPAIRED_PENDING_PICKUP': 'Pending pickup',
  'DELIVERED': 'Delivered',
  'UNREPAIRABLE_RETURNED': 'Unrepairable (returned)',
};

bool repairCountsInProfit(String status) => status == 'DELIVERED';

String repairStatusLabel(String status) =>
    repairStatusLabels[status] ?? status;
