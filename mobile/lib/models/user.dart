class User {
  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    this.address,
    this.dateOfBirth,
    this.customerCode,
    this.referralCode,
    this.avatarUrl,
    this.tier,
    this.redeemablePoints = 0,
    this.tierPoints365d = 0,
    this.totalSpent = 0,
    this.earnMultiplier = 1,
    this.pointsExpireAt,
    this.loginStreak = 0,
    this.preferences,
    this.raw,
  });

  final int id;
  final String name;
  final String email;
  final String role;
  final String? phone;
  final String? address;
  final String? dateOfBirth;
  final String? customerCode;
  final String? referralCode;
  final String? avatarUrl;
  final String? tier;
  final num redeemablePoints;
  final num tierPoints365d;
  final num totalSpent;
  final num earnMultiplier;
  final String? pointsExpireAt;
  final int loginStreak;
  final Map<String, dynamic>? preferences;
  final Map<String, dynamic>? raw;

  bool get isCustomer => role == 'customer';
  bool get isStaff => role == 'staff';
  bool get isAdmin => role == 'admin';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: _asInt(json['id']),
      name: '${json['name'] ?? ''}',
      email: '${json['email'] ?? ''}',
      role: '${json['role'] ?? 'customer'}',
      phone: json['phone']?.toString(),
      address: json['address']?.toString(),
      dateOfBirth: json['date_of_birth']?.toString(),
      customerCode: json['customer_code']?.toString(),
      referralCode: json['referral_code']?.toString(),
      avatarUrl: json['avatar_url']?.toString() ?? json['avatar']?.toString(),
      tier: json['tier']?.toString(),
      redeemablePoints: _asNum(json['redeemable_points']),
      tierPoints365d: _asNum(json['tier_points_365d']),
      totalSpent: _asNum(json['total_spent']),
      earnMultiplier: _asNum(json['earn_multiplier'], 1),
      pointsExpireAt: json['points_expire_at']?.toString(),
      loginStreak: _asInt(json['login_streak']),
      preferences: json['preferences'] is Map<String, dynamic>
          ? json['preferences'] as Map<String, dynamic>
          : null,
      raw: json,
    );
  }

  Map<String, dynamic> toJson() => raw ?? {
        'id': id,
        'name': name,
        'email': email,
        'role': role,
        'phone': phone,
        'customer_code': customerCode,
        'referral_code': referralCode,
        'avatar_url': avatarUrl,
        'tier': tier,
        'redeemable_points': redeemablePoints,
      };

  static int _asInt(dynamic v) =>
      v is int ? v : int.tryParse('$v') ?? 0;
  static num _asNum(dynamic v, [num d = 0]) =>
      v is num ? v : num.tryParse('$v') ?? d;
}
