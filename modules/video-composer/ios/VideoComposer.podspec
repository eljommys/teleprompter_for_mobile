Pod::Spec.new do |s|
  s.name           = 'VideoComposer'
  s.version        = '1.0.0'
  s.summary        = 'Funde dos tomas en una sola, con la segunda en un recuadro.'
  s.description    = 'Composicion picture-in-picture con AVFoundation.'
  s.author         = ''
  s.homepage       = 'https://rackslabs.com'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
