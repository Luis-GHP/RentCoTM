import { View } from 'react-native';

export function PageBackground({ tint = '47,74,125' }: { tint?: string }) {
  const blockPattern = [
    { left: 0, top: 0, width: 46, height: 1 },
    { left: 0, top: 22, width: 78, height: 1 },
    { left: 0, top: 44, width: 58, height: 1 },
    { left: 0, top: 0, width: 1, height: 44 },
    { left: 28, top: 0, width: 1, height: 66 },
    { left: 56, top: 22, width: 1, height: 44 },
  ];

  const bands = [
    { top: 82, right: -80, width: 240, opacity: 0.07 },
    { top: 106, right: -56, width: 190, opacity: 0.058 },
    { bottom: 156, left: -70, width: 220, opacity: 0.058 },
    { bottom: 132, left: -42, width: 160, opacity: 0.045 },
    { bottom: 260, right: -92, width: 150, opacity: 0.038 },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <View style={{ position: 'absolute', top: 0, right: 0, width: 190, height: 190, borderBottomLeftRadius: 190, backgroundColor: `rgba(${tint},0.034)` }} />
      <View style={{ position: 'absolute', top: 108, right: -40, width: 86, height: 86, borderRadius: 43, borderWidth: 1, borderColor: `rgba(${tint},0.04)` }} />
      <View style={{ position: 'absolute', bottom: -66, left: -82, width: 236, height: 236, borderRadius: 118, backgroundColor: `rgba(${tint},0.03)` }} />

      {bands.map((band, index) => (
        <View
          key={`band-${index}`}
          style={{
            position: 'absolute',
            top: band.top,
            bottom: band.bottom,
            left: band.left,
            right: band.right,
            width: band.width,
            height: 12,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: `rgba(${tint},${band.opacity})`,
            transform: [{ rotate: '-12deg' }],
          }}
        />
      ))}

      <View style={{ position: 'absolute', top: 176, right: 18, width: 82, height: 70, opacity: 0.72 }}>
        {blockPattern.map((line, index) => (
          <View key={`top-grid-${index}`} style={{ position: 'absolute', backgroundColor: `rgba(${tint},0.055)`, ...line }} />
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: 112, left: 20, width: 82, height: 70, opacity: 0.56 }}>
        {blockPattern.map((line, index) => (
          <View key={`bottom-grid-${index}`} style={{ position: 'absolute', backgroundColor: `rgba(${tint},0.055)`, ...line }} />
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: 306, right: 28, width: 54, height: 46, opacity: 0.34 }}>
        {blockPattern.slice(0, 4).map((line, index) => (
          <View key={`small-grid-${index}`} style={{ position: 'absolute', backgroundColor: `rgba(${tint},0.052)`, ...line, width: line.width > 1 ? line.width * 0.62 : line.width, height: line.height > 1 ? line.height * 0.62 : line.height }} />
        ))}
      </View>
    </View>
  );
}
