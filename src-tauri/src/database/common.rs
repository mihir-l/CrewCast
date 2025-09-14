pub struct TsFilter {
	pub timestamp: i64,
	pub direction: TsDirection,
}

pub enum TsDirection {
	Newer,
}
