class IosSimulatorCli < Formula
  desc "CLI for interacting with iOS simulators"
  homepage "https://github.com/DebugSwift/ios-simulator-cli"
  url "https://github.com/DebugSwift/ios-simulator-cli/archive/refs/heads/main.tar.gz"
  version "1.6.0"
  sha256 "9f1f0322628a0ef9f43157cb3c3ba745c660c76d679eb03befbdc365ce27a39e"
  license "MIT"
  head "https://github.com/DebugSwift/ios-simulator-cli.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "ci"
    system "npm", "run", "build"
    bin.install "build/index.js" => "ios-simulator-cli"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/ios-simulator-cli --version")
  end
end
