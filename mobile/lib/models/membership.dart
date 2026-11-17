class Membership {
  Membership({
    required this.customerCode,
    required this.name,
    this.email,
    this.phone,
    this.referralCode,
    this.tier = 'care',
    this.redeemablePoints = 0,
    this.tierPoints365d = 0,
    this.totalSpent = 0,
    this.earnMultiplier = 1,
    this.pointsExpireAt,
    this.loginStreak = 0,
    this.nextTier,
    this.tiers,
    this.settings,
  });

  final String customerCode;
  final String name;
  final String? email;
  final String? phone;
  final String? referralCode;
  final String tier;
  final num redeemablePoints;
  final num tierPoints365d;
  final num totalSpent;
  final num earnMultiplier;
  final String? pointsExpireAt;
  final int loginStreak;
  final Map<String, dynamic>? nextTier;
  final Map<String, dynamic>? tiers;
  final Map<String, dynamic>? settings;

  List<String> get currentPerks {
    final tierData = tiers?[tier];
    if (tierData is Map && tierData['perks'] is List) {
      return (tierData['perks'] as List).map((e) => '$e').toList();
    }
    return const [];
  }

  factory Membership.fromJson(Map<String, dynamic> json) {
    return Membership(
      customerCode: '${json['customer_code'] ?? ''}',
      name: '${json['name'] ?? ''}',
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      referralCode: json['referral_code']?.toString(),
      tier: '${json['tier'] ?? 'care'}'.toLowerCase(),
      redeemablePoints: json['redeemable_points'] is num
          ? json['redeemable_points'] as num
          : num.tryParse('${json['redeemable_points']}') ?? 0,
      tierPoints365d: json['tier_points_365d'] is num
          ? json['tier_points_365d'] as num
          : 0,
      totalSpent: json['total_spent'] is num ? json['total_spent'] as num : 0,
      earnMultiplier: json['earn_multiplier'] is num
          ? json['earn_multiplier'] as num
          : 1,
      pointsExpireAt: json['points_expire_at']?.toString(),
      loginStreak: json['login_streak'] is int
          ? json['login_streak'] as int
          : int.tryParse('${json['login_streak']}') ?? 0,
      nextTier: json['next_tier'] is Map<String, dynamic>
          ? json['next_tier'] as Map<String, dynamic>
          : null,
      tiers: json['tiers'] is Map<String, dynamic>
          ? json['tiers'] as Map<String, dynamic>
          : null,
      settings: json['settings'] is Map<String, dynamic>
          ? json['settings'] as Map<String, dynamic>
          : null,
    );
  }
}
