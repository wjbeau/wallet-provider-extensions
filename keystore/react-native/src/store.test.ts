import { describe, expect, it } from "vitest";

function parsePath(path: string): number[] {
	return path
		.replace(/^m\/?/, "")
		.split("/")
		.map((part) => {
			const hardened = part.endsWith("'") || part.endsWith("h");
			const index = parseInt(part.replace(/['h]$/, ""), 10);
			return hardened ? index + 0x80000000 : index;
		});
}

describe("react-native-keystore store.ts logic", () => {
    describe("parsePath", () => {
        it("should parse a standard BIP44 path", () => {
            const path = "m/44'/283'/0'/0/0";
            const result = parsePath(path);
            expect(result).toEqual([
                0x80000000 + 44,
                0x80000000 + 283,
                0x80000000 + 0,
                0,
                0
            ]);
        });

        it("should handle paths without 'm/' prefix", () => {
            const path = "44'/283'/0'/0/1";
            const result = parsePath(path);
            expect(result).toEqual([
                0x80000000 + 44,
                0x80000000 + 283,
                0x80000000 + 0,
                0,
                1
            ]);
        });

        it("should handle mixed hardened and non-hardened parts", () => {
            const path = "m/44'/283/0'/1/2";
            const result = parsePath(path);
            expect(result).toEqual([
                0x80000000 + 44,
                283,
                0x80000000 + 0,
                1,
                2
            ]);
        });
    });
});
